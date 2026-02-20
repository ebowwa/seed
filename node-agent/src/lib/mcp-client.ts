/**
 * MCP Client - Simple MCP (Model Context Protocol) stdio client
 *
 * A minimal MCP client for spawning and communicating with MCP servers via stdio.
 * Supports tool discovery and execution.
 *
 * Based on MCP spec: https://spec.modelcontextprotocol.io/
 */

import { spawn, ChildProcess } from "child_process";

// ============================================================================
// Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JSONRPCResponse {
  jsonrpc?: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * MCP Server configuration from .mcp.json
 */
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * MCP Config structure
 */
export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

// ============================================================================
// MCPClient
// ============================================================================

/**
 * Simple MCP client for stdio transport
 */
export class MCPClient {
  private serverName: string;
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: JSONRPCResponse) => void;
    reject: (error: Error) => void;
  }>();
  private initialized = false;

  constructor(serverName: string, config: MCPServerConfig) {
    this.serverName = serverName;
    this.config = config;
  }

  /**
   * Start the MCP server process
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error(`MCP server ${this.serverName} already running`);
    }

    console.log(`[MCP] Starting server: ${this.serverName}`);

    this.process = spawn(this.config.command, this.config.args || [], {
      env: { ...process.env, ...this.config.env },
      stdio: ["pipe", "pipe", "inherit"],
    });

    const proc = this.process;

    // Handle stdout (JSON-RPC responses)
    proc.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const response = JSON.parse(line) as JSONRPCResponse;
          this.handleResponse(response);
        } catch (error) {
          console.error(`[MCP] Failed to parse response:`, line);
        }
      }
    });

    // Handle process errors
    proc.on("error", (error) => {
      console.error(`[MCP] Process error for ${this.serverName}:`, error);
      // Reject all pending requests
      for (const [id, { reject }] of this.pendingRequests) {
        reject(error);
        this.pendingRequests.delete(id);
      }
    });

    // Handle process exit
    proc.on("exit", (code, signal) => {
      console.log(`[MCP] Server ${this.serverName} exited: code=${code}, signal=${signal}`);
      this.process = null;
      this.initialized = false;
      // Reject all pending requests
      for (const [id, { reject }] of this.pendingRequests) {
        reject(new Error(`MCP server exited: ${signal || code}`));
        this.pendingRequests.delete(id);
      }
    });

    // Initialize the MCP server
    await this.initialize();
  }

  /**
   * Initialize the MCP server (send initialize request)
   */
  private async initialize(): Promise<void> {
    const initResponse = await this.sendRequest({
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "seed-node-agent",
          version: "1.0.0",
        },
      },
    });

    if (initResponse.error) {
      throw new Error(
        `MCP initialize failed: ${initResponse.error.message}`
      );
    }

    // Send initialized notification
    this.sendNotification({
      method: "notifications/initialized",
    });

    this.initialized = true;
    console.log(`[MCP] Server ${this.serverName} initialized`);
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) {
      throw new Error(`MCP server ${this.serverName} not initialized`);
    }

    const response = await this.sendRequest({
      method: "tools/list",
    });

    if (response.error) {
      throw new Error(
        `tools/list failed: ${response.error.message}`
      );
    }

    const result = response.result as { tools?: MCPTool[] };
    return result.tools || [];
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) {
      throw new Error(`MCP server ${this.serverName} not initialized`);
    }

    const response = await this.sendRequest({
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    });

    if (response.error) {
      throw new Error(
        `Tool call failed: ${response.error.message}`
      );
    }

    return response.result;
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private sendRequest(params: {
    method: string;
    params?: unknown;
  }): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;

      this.pendingRequests.set(id, { resolve, reject });

      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id,
        method: params.method,
        params: params.params,
      };

      this.sendRequestRaw(request);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${params.method}`));
        }
      }, 30000);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private sendNotification(params: {
    method: string;
    params?: unknown;
  }): void {
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: `notification-${Date.now()}`,
      method: params.method,
      params: params.params,
    };

    this.sendRequestRaw(request);
  }

  /**
   * Write a request to the process stdin
   */
  private sendRequestRaw(request: JSONRPCRequest): void {
    if (!this.process || !this.process.stdin) {
      throw new Error(`MCP server ${this.serverName} not running`);
    }

    const data = JSON.stringify(request);
    this.process.stdin.write(data + "\n");
  }

  /**
   * Handle a JSON-RPC response
   */
  private handleResponse(response: JSONRPCResponse): void {
    const id = typeof response.id === "number" ? response.id : parseInt(String(response.id), 10);
    const pending = this.pendingRequests.get(id);

    if (pending) {
      this.pendingRequests.delete(id);
      pending.resolve(response);
    }
  }

  /**
   * Stop the MCP server process
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log(`[MCP] Stopping server: ${this.serverName}`);

    // Send shutdown request
    try {
      await this.sendRequest({ method: "shutdown" });
    } catch (error) {
      // Ignore shutdown errors
    }

    // Kill the process
    this.process.kill();
    this.process = null;
    this.initialized = false;
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.process !== null && this.initialized;
  }
}

// ============================================================================
// MCPManager - Manages multiple MCP servers
// ============================================================================

/**
 * Manages multiple MCP servers
 */
export class MCPManager {
  private clients = new Map<string, MCPClient>();
  private tools = new Map<string, { client: MCPClient; tool: MCPTool }>();

  /**
   * Load MCP config from a file path
   */
  static async loadConfig(configPath: string): Promise<MCPConfig> {
    const fs = await import("fs/promises");
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content) as MCPConfig;
  }

  /**
   * Create an MCPManager from a config file
   */
  static async fromConfig(configPath: string): Promise<MCPManager> {
    const config = await MCPManager.loadConfig(configPath);
    const manager = new MCPManager();

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      const client = new MCPClient(serverName, serverConfig);
      manager.clients.set(serverName, client);
    }

    return manager;
  }

  /**
   * Start all MCP servers
   */
  async startAll(): Promise<void> {
    console.log(`[MCP] Starting ${this.clients.size} servers...`);

    for (const [name, client] of this.clients) {
      try {
        await client.start();
      } catch (error) {
        console.error(`[MCP] Failed to start ${name}:`, error);
      }
    }
  }

  /**
   * Discover all tools from all servers
   */
  async discoverTools(): Promise<void> {
    this.tools.clear();

    for (const [name, client] of this.clients) {
      if (!client.isRunning()) {
        console.log(`[MCP] Skipping ${name} (not running)`);
        continue;
      }

      try {
        const serverTools = await client.listTools();
        console.log(`[MCP] ${name} has ${serverTools.length} tools`);

        for (const tool of serverTools) {
          this.tools.set(tool.name, { client, tool });
        }
      } catch (error) {
        console.error(`[MCP] Failed to discover tools from ${name}:`, error);
      }
    }

    console.log(`[MCP] Discovered ${this.tools.size} tools total`);
  }

  /**
   * Get all discovered tools
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values()).map((v) => v.tool);
  }

  /**
   * Call a tool by name
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const entry = this.tools.get(name);

    if (!entry) {
      throw new Error(`Tool not found: ${name}`);
    }

    return entry.client.callTool(name, args);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Stop all MCP servers
   */
  async stopAll(): Promise<void> {
    console.log(`[MCP] Stopping ${this.clients.size} servers...`);

    for (const [name, client] of this.clients) {
      try {
        await client.stop();
      } catch (error) {
        console.error(`[MCP] Failed to stop ${name}:`, error);
      }
    }

    this.clients.clear();
    this.tools.clear();
  }
}
