// Node Registry Service
// Manages the registry of all known node-agent instances
// Handles health checking via HTTP /api/status

import { promises as fsp } from "fs";
import path from "path";
import type {
  NodeRegistryConfig,
  NodeConfig,
  RegisteredNode,
  NodeStatus,
} from "../types/index";

const CONFIG_PATHS = [
  path.join(process.cwd(), "src", "config", "nodes.yaml"),
  path.join(process.env.HOME || "", ".node-agent", "nodes.yaml"),
  process.env.NODES_CONFIG_PATH || "",
].filter(Boolean);

const HEALTH_CHECK_INTERVAL_MS = 60000; // 1 minute
const API_TIMEOUT_MS = 5000; // 5 seconds

export class NodeRegistryService {
  private nodes: Map<string, RegisteredNode> = new Map();
  private configPath: string | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Load node registry from config file
   */
  async loadConfig(configPath?: string): Promise<void> {
    const pathsToTry = configPath ? [configPath] : CONFIG_PATHS;

    for (const filePath of pathsToTry) {
      try {
        const content = await fsp.readFile(filePath, "utf-8");

        // Parse YAML (simple implementation for our format)
        const config = this.parseYamlConfig(content);

        // Update nodes map
        for (const node of config.nodes) {
          this.nodes.set(node.id, {
            ...node,
            status: "offline",
          });
        }

        this.configPath = filePath;
        console.log(`[NodeRegistry] Loaded ${config.nodes.length} nodes from ${filePath}`);
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`[NodeRegistry] Failed to load config from ${filePath}:`, error);
        }
      }
    }

    // No config found, start with empty registry
    console.warn("[NodeRegistry] No nodes.yaml config found, starting with empty registry");
    this.nodes.clear();
  }

  /**
   * Simple YAML parser for node config format
   * Handles: nodes: - id: xxx host: xxx port: xxx label: xxx
   */
  private parseYamlConfig(content: string): NodeRegistryConfig {
    const config: NodeRegistryConfig = { nodes: [] };
    const lines = content.split("\n");
    let currentNode: Partial<NodeConfig> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Start of nodes list
      if (trimmed.startsWith("nodes:")) {
        continue;
      }

      // New node entry
      if (trimmed.startsWith("- id:")) {
        if (currentNode && currentNode.id && currentNode.host && currentNode.port) {
          config.nodes.push(currentNode as NodeConfig);
        }
        currentNode = { id: trimmed.split(":")[1].trim(), port: 8911 };
      } else if (currentNode) {
        // Parse node properties
        const [key, ...valueParts] = trimmed.split(":");
        const value = valueParts.join(":").trim();

        switch (key.trim()) {
          case "id":
            currentNode.id = value;
            break;
          case "host":
            currentNode.host = value;
            break;
          case "port":
            currentNode.port = parseInt(value, 10);
            break;
          case "label":
            currentNode.label = value;
            break;
          case "location":
            currentNode.location = value;
            break;
          case "server_type":
            currentNode.server_type = value;
            break;
        }
      }
    }

    // Don't forget the last node
    if (currentNode && currentNode.id && currentNode.host && currentNode.port) {
      config.nodes.push(currentNode as NodeConfig);
    }

    return config;
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): RegisteredNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all registered nodes
   */
  getAllNodes(): RegisteredNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get only online nodes
   */
  getOnlineNodes(): RegisteredNode[] {
    return this.getAllNodes().filter((n) => n.status === "online");
  }

  /**
   * Get nodes by status
   */
  getNodesByStatus(status: "online" | "offline" | "degraded"): RegisteredNode[] {
    return this.getAllNodes().filter((n) => n.status === status);
  }

  /**
   * Add or update a node
   */
  setNode(node: NodeConfig): void {
    this.nodes.set(node.id, {
      ...node,
      status: this.nodes.get(node.id)?.status || "offline",
    });
  }

  /**
   * Remove a node
   */
  removeNode(id: string): boolean {
    return this.nodes.delete(id);
  }

  /**
   * Get node status from node-agent API
   */
  async fetchNodeStatus(node: RegisteredNode): Promise<NodeStatus | null> {
    const url = `http://${node.host}:${node.port}/api/status`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.data as NodeStatus;
    } catch (error) {
      console.error(`[NodeRegistry] Failed to fetch status for ${node.id}:`, error);
      return null;
    }
  }

  /**
   * Update node status (health check)
   */
  async updateNodeStatus(id: string): Promise<boolean> {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }

    const status = await this.fetchNodeStatus(node);
    if (status) {
      const registeredNode = this.nodes.get(id)!;
      registeredNode.status = "online";
      registeredNode.last_seen = new Date().toISOString();
      registeredNode.node_status = status;
      return true;
    } else {
      const registeredNode = this.nodes.get(id)!;
      registeredNode.status = "offline";
      return false;
    }
  }

  /**
   * Health check all nodes
   */
  async healthCheckAll(): Promise<{ online: number; offline: number; degraded: number }> {
    const results = { online: 0, offline: 0, degraded: 0 };

    const promises = Array.from(this.nodes.keys()).map(async (id) => {
      const isOnline = await this.updateNodeStatus(id);
      const node = this.nodes.get(id)!;
      if (node.status === "online") {
        results.online++;
      } else if (node.status === "degraded") {
        results.degraded++;
      } else {
        results.offline++;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = HEALTH_CHECK_INTERVAL_MS): void {
    if (this.healthCheckInterval) {
      console.warn("[NodeRegistry] Health checks already running");
      return;
    }

    console.log(`[NodeRegistry] Starting health checks (interval: ${intervalMs}ms)`);

    // Initial health check
    this.healthCheckAll();

    this.healthCheckInterval = setInterval(() => {
      this.healthCheckAll();
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log("[NodeRegistry] Health checks stopped");
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): { total: number; online: number; offline: number; degraded: number } {
    const nodes = this.getAllNodes();
    return {
      total: nodes.length,
      online: nodes.filter((n) => n.status === "online").length,
      offline: nodes.filter((n) => n.status === "offline").length,
      degraded: nodes.filter((n) => n.status === "degraded").length,
    };
  }

  /**
   * Get node for a worktree (load balancing)
   * Returns the node with the most available resources
   */
  getBestNodeForWorktree(): RegisteredNode | null {
    const onlineNodes = this.getOnlineNodes();
    if (onlineNodes.length === 0) {
      return null;
    }

    // Sort by available capacity (CPU free %, memory free %)
    return onlineNodes.sort((a, b) => {
      const aCapacity = a.node_status?.capacity || { cpu_percent: 100, memory_percent: 100 };
      const bCapacity = b.node_status?.capacity || { cpu_percent: 100, memory_percent: 100 };

      const aFree = (100 - aCapacity.cpu_percent) + (100 - aCapacity.memory_percent);
      const bFree = (100 - bCapacity.cpu_percent) + (100 - bCapacity.memory_percent);

      return bFree - aFree; // Descending order
    })[0];
  }
}
