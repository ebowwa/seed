// PM Monitor Service
// Monitor loop - polls all nodes, detects state changes, feeds events to PM brain
// Events: Ralph completions, errors, stalls, node status changes, resource warnings

import type {
  RegisteredNode,
  RalphLoop,
  NodeStatus,
  MonitorEvent,
  RalphStallEvent,
  RalphCompletionEvent,
  RalphErrorEvent,
} from "../types/index";

export interface MonitorOptions {
  onEvent?: (event: MonitorEvent) => Promise<void>;
  signal?: AbortSignal;
}

export interface MonitorConfig {
  intervalMs: number;
  stallThresholdMinutes: number;
  milestoneIntervals?: number[]; // e.g., [10, 25, 50, 100] for iteration milestones
  resourceThresholds?: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
}

interface NodeStateSnapshot {
  nodeId: string;
  loops: Map<string, RalphLoopStateSnapshot>;
  lastSeen: string;
}

interface RalphLoopStateSnapshot {
  id: string;
  status: RalphLoop["status"];
  iteration: number;
  last_activity: string;
}

const DEFAULT_CONFIG: MonitorConfig = {
  intervalMs: 30000, // 30 seconds
  stallThresholdMinutes: 10,
  milestoneIntervals: [10, 25, 50, 100],
  resourceThresholds: {
    cpu_percent: 90,
    memory_percent: 85,
    disk_percent: 90,
  },
};

export class PmMonitorService {
  private config: MonitorConfig;
  private nodeSnapshots: Map<string, NodeStateSnapshot> = new Map();
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<MonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the monitor loop
   */
  async startMonitoring(
    nodes: () => RegisteredNode[],
    options: MonitorOptions = {}
  ): Promise<void> {
    if (this.isRunning) {
      console.warn("[PmMonitor] Monitoring already running");
      return;
    }

    this.isRunning = true;
    console.log(`[PmMonitor] Starting monitor loop (interval: ${this.config.intervalMs}ms)`);

    // Initial snapshot
    await this.updateSnapshots(nodes());

    // Start monitoring loop
    this.monitorInterval = setInterval(async () => {
      if (options.signal?.aborted) {
        this.stopMonitoring();
        return;
      }

      try {
        await this.monitorCycle(nodes(), options);
      } catch (error) {
        console.error("[PmMonitor] Error in monitor cycle:", error);
      }
    }, this.config.intervalMs);

    // First cycle immediately
    await this.monitorCycle(nodes(), options);
  }

  /**
   * Stop the monitor loop
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    console.log("[PmMonitor] Monitoring stopped");
  }

  /**
   * Check if monitoring is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Single monitor cycle - check all nodes for state changes
   */
  private async monitorCycle(
    nodes: RegisteredNode[],
    options: MonitorOptions
  ): Promise<void> {
    const now = new Date().toISOString();

    for (const node of nodes) {
      // Skip offline nodes for state comparison
      if (node.status === "offline") {
        // Check if node went from online to offline
        const snapshot = this.nodeSnapshots.get(node.id);
        if (snapshot && node.node_status) {
          await this.emitEvent({
            type: "node_offline",
            timestamp: now,
            node_id: node.id,
            data: {
              message: `Node ${node.id} (${node.label}) is now offline`,
            },
            priority: "high",
          }, options);
        }
        continue;
      }

      // Update node status
      if (node.status === "online" && node.node_status) {
        await this.checkNodeState(node, options);
      }
    }

    // Clean up snapshots for nodes that no longer exist
    const currentNodeIds = new Set(nodes.map((n) => n.id));
    for (const nodeId of this.nodeSnapshots.keys()) {
      if (!currentNodeIds.has(nodeId)) {
        this.nodeSnapshots.delete(nodeId);
      }
    }
  }

  /**
   * Check a single node for state changes
   */
  private async checkNodeState(
    node: RegisteredNode,
    options: MonitorOptions
  ): Promise<void> {
    if (!node.node_status) {
      return;
    }

    const now = new Date().toISOString();
    const previousSnapshot = this.nodeSnapshots.get(node.id);
    const loops = node.node_status.ralph_loops || [];

    // Check for resource warnings
    await this.checkResourceThresholds(node, options);

    // Check for new nodes coming online
    if (!previousSnapshot) {
      await this.emitEvent({
        type: "node_online",
        timestamp: now,
        node_id: node.id,
        data: {
          message: `Node ${node.id} (${node.label}) is now online`,
        },
        priority: "low",
      }, options);
    }

    // Check Ralph loops for state changes
    const previousLoops = previousSnapshot?.loops || new Map();

    for (const loop of loops) {
      const previousState = previousLoops.get(loop.id);

      // New loop detected
      if (!previousState) {
        await this.emitEvent({
          type: "ralph_started",
          timestamp: now,
          node_id: node.id,
          data: {
            loop_id: loop.id,
            worktree_id: loop.worktree_id,
            prompt: loop.prompt.substring(0, 100) + (loop.prompt.length > 100 ? "..." : ""),
            git_info: loop.git_info,
          },
          priority: "low",
        }, options);
        continue;
      }

      // Check for loop state changes
      await this.checkLoopStateChanges(node, loop, previousState, options);
    }

    // Check for completed loops (removed from list)
    if (previousSnapshot) {
      for (const [loopId, previousLoop] of previousSnapshot.loops) {
        const currentLoop = loops.find((l) => l.id === loopId);

        if (!currentLoop) {
          // Loop was removed from the list - could mean completion or cleanup
          if (previousLoop.status === "running") {
            await this.emitEvent({
              type: "ralph_completed",
              timestamp: now,
              node_id: node.id,
              data: {
                loop_id: loopId,
                worktree_id: "", // Not available
                total_iterations: previousLoop.iteration,
                total_commits: 0,
                duration_seconds: 0,
              },
              priority: "medium",
            }, options);
          }
        }
      }
    }

    // Update snapshot
    await this.updateNodeSnapshot(node, loops);
  }

  /**
   * Check for Ralph loop state changes
   */
  private async checkLoopStateChanges(
    node: RegisteredNode,
    loop: RalphLoop,
    previousState: RalphLoopStateSnapshot,
    options: MonitorOptions
  ): Promise<void> {
    const now = new Date().toISOString();
    const nowDate = new Date(now);
    const lastActivityDate = new Date(loop.last_activity || loop.started_at);

    // Check for completion
    if (previousState.status === "running" && loop.status === "complete") {
      const startedAt = new Date(loop.started_at);
      const durationSeconds = Math.floor((nowDate.getTime() - startedAt.getTime()) / 1000);

      await this.emitEvent({
        type: "ralph_completed",
        timestamp: now,
        node_id: node.id,
        data: {
          loop_id: loop.id,
          worktree_id: loop.worktree_id,
          total_iterations: loop.iteration,
          total_commits: loop.recent_commits?.length || 0,
          duration_seconds: durationSeconds,
        },
        priority: "medium",
      }, options);
      return;
    }

    // Check for errors
    if (loop.status === "error") {
      await this.emitEvent({
        type: "ralph_errored",
        timestamp: now,
        node_id: node.id,
        data: {
          loop_id: loop.id,
          worktree_id: loop.worktree_id,
          iteration: loop.iteration,
          error_message: loop.error_message || "Unknown error",
        },
        priority: "high",
      }, options);
      return;
    }

    // Check for stalls
    if (loop.status === "running") {
      const stallThresholdMs = this.config.stallThresholdMinutes * 60 * 1000;
      const timeSinceActivity = nowDate.getTime() - lastActivityDate.getTime();

      if (timeSinceActivity > stallThresholdMs) {
        await this.emitEvent({
          type: "ralph_stalled",
          timestamp: now,
          node_id: node.id,
          data: {
            loop_id: loop.id,
            worktree_id: loop.worktree_id,
            iteration: loop.iteration,
            last_activity: loop.last_activity || loop.started_at,
            stall_duration_minutes: Math.floor(timeSinceActivity / (60 * 1000)),
          },
          priority: "high",
        }, options);
      }
    }

    // Check for iteration milestones
    if (this.config.milestoneIntervals) {
      for (const milestone of this.config.milestoneIntervals) {
        if (loop.iteration === milestone && previousState.iteration < milestone) {
          await this.emitEvent({
            type: "ralph_milestone",
            timestamp: now,
            node_id: node.id,
            data: {
              loop_id: loop.id,
              worktree_id: loop.worktree_id,
              iteration: loop.iteration,
              milestone,
            },
            priority: "low",
          }, options);
        }
      }
    }
  }

  /**
   * Check resource thresholds
   */
  private async checkResourceThresholds(
    node: RegisteredNode,
    options: MonitorOptions
  ): Promise<void> {
    if (!node.node_status || !this.config.resourceThresholds) {
      return;
    }

    const capacity = node.node_status.capacity;
    const thresholds = this.config.resourceThresholds;
    const warnings: string[] = [];

    if (capacity.cpu_percent > thresholds.cpu_percent) {
      warnings.push(`CPU at ${capacity.cpu_percent}%`);
    }

    if (capacity.memory_percent > thresholds.memory_percent) {
      warnings.push(`Memory at ${capacity.memory_percent}%`);
    }

    if (capacity.disk_percent > thresholds.disk_percent) {
      warnings.push(`Disk at ${capacity.disk_percent}%`);
    }

    if (warnings.length > 0) {
      await this.emitEvent({
        type: "node_high_resources",
        timestamp: new Date().toISOString(),
        node_id: node.id,
        data: {
          warnings,
          capacity,
        },
        priority: "medium",
      }, options);
    }
  }

  /**
   * Update node snapshot
   */
  private async updateNodeSnapshot(
    node: RegisteredNode,
    loops: RalphLoop[]
  ): Promise<void> {
    const loopSnapshots = new Map<string, RalphLoopStateSnapshot>();

    for (const loop of loops) {
      loopSnapshots.set(loop.id, {
        id: loop.id,
        status: loop.status,
        iteration: loop.iteration,
        last_activity: loop.last_activity || loop.started_at,
      });
    }

    this.nodeSnapshots.set(node.id, {
      nodeId: node.id,
      loops: loopSnapshots,
      lastSeen: new Date().toISOString(),
    });
  }

  /**
   * Update all snapshots
   */
  private async updateSnapshots(nodes: RegisteredNode[]): Promise<void> {
    for (const node of nodes) {
      if (node.status === "online" && node.node_status) {
        await this.updateNodeSnapshot(node, node.node_status.ralph_loops || []);
      }
    }
  }

  /**
   * Emit a monitor event
   */
  private async emitEvent(
    event: MonitorEvent,
    options: MonitorOptions
  ): Promise<void> {
    if (options.onEvent) {
      try {
        await options.onEvent(event);
      } catch (error) {
        console.error("[PmMonitor] Error in event handler:", error);
      }
    }
  }

  /**
   * Get current state snapshots
   */
  getSnapshots(): Map<string, NodeStateSnapshot> {
    return new Map(this.nodeSnapshots);
  }

  /**
   * Get snapshot for a specific node
   */
  getNodeSnapshot(nodeId: string): NodeStateSnapshot | undefined {
    return this.nodeSnapshots.get(nodeId);
  }
}
