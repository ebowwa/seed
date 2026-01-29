// PM Monitor Service
// Monitor loop - polls local node, detects state changes, feeds events to PM brain
// Events: Ralph completions, errors, stalls, resource warnings

import type {
  RalphLoop,
  NodeStatus,
  MonitorEvent,
} from "../../types/index";

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

const LOCALHOST = "127.0.0.1";
const API_PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);

export class PmMonitorService {
  private config: MonitorConfig;
  private loopSnapshots: Map<string, RalphLoopStateSnapshot> = new Map();
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private localNodeId: string = "localhost";

  constructor(config?: Partial<MonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the monitor loop
   */
  async startMonitoring(options: MonitorOptions = {}): Promise<void> {
    if (this.isRunning) {
      console.warn("[PmMonitor] Monitoring already running");
      return;
    }

    this.isRunning = true;
    console.log(`[PmMonitor] Starting monitor loop (interval: ${this.config.intervalMs}ms)`);

    // Get local node ID
    const initialStatus = await this.fetchLocalStatus();
    if (initialStatus) {
      this.localNodeId = initialStatus.node_id;
    }

    // Start monitoring loop
    this.monitorInterval = setInterval(async () => {
      if (options.signal?.aborted) {
        this.stopMonitoring();
        return;
      }

      try {
        await this.monitorCycle(options);
      } catch (error) {
        console.error("[PmMonitor] Error in monitor cycle:", error);
      }
    }, this.config.intervalMs);

    // First cycle immediately
    await this.monitorCycle(options);
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
   * Single monitor cycle - check local node for state changes
   */
  private async monitorCycle(options: MonitorOptions): Promise<void> {
    const status = await this.fetchLocalStatus();
    if (!status) {
      return;
    }

    const now = new Date().toISOString();
    const loops = status.ralph_loops || [];

    // Check for resource warnings
    await this.checkResourceThresholds(status, options);

    // Check Ralph loops for state changes
    for (const loop of loops) {
      const previousState = this.loopSnapshots.get(loop.id);

      // New loop detected
      if (!previousState) {
        await this.emitEvent({
          type: "ralph_started",
          timestamp: now,
          node_id: this.localNodeId,
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
      await this.checkLoopStateChanges(loop, previousState, options);
    }

    // Check for completed loops (removed from list)
    for (const [loopId, previousLoop] of this.loopSnapshots) {
      const currentLoop = loops.find((l) => l.id === loopId);

      if (!currentLoop) {
        // Loop was removed from the list - could mean completion or cleanup
        if (previousLoop.status === "running") {
          await this.emitEvent({
            type: "ralph_completed",
            timestamp: now,
            node_id: this.localNodeId,
            data: {
              loop_id: loopId,
              worktree_id: "",
              total_iterations: previousLoop.iteration,
              total_commits: 0,
              duration_seconds: 0,
            },
            priority: "medium",
          }, options);
        }
      }
    }

    // Update snapshots
    this.updateLoopSnapshots(loops);
  }

  /**
   * Check for Ralph loop state changes
   */
  private async checkLoopStateChanges(
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
        node_id: this.localNodeId,
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
        node_id: this.localNodeId,
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
          node_id: this.localNodeId,
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
            node_id: this.localNodeId,
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
    status: NodeStatus,
    options: MonitorOptions
  ): Promise<void> {
    if (!this.config.resourceThresholds) {
      return;
    }

    const capacity = status.capacity;
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
        node_id: this.localNodeId,
        data: {
          warnings,
          capacity,
        },
        priority: "medium",
      }, options);
    }
  }

  /**
   * Update loop snapshots
   */
  private updateLoopSnapshots(loops: RalphLoop[]): void {
    // Remove snapshots for loops that no longer exist
    const currentLoopIds = new Set(loops.map((l) => l.id));
    for (const loopId of this.loopSnapshots.keys()) {
      if (!currentLoopIds.has(loopId)) {
        this.loopSnapshots.delete(loopId);
      }
    }

    // Update or add snapshots for current loops
    for (const loop of loops) {
      this.loopSnapshots.set(loop.id, {
        id: loop.id,
        status: loop.status,
        iteration: loop.iteration,
        last_activity: loop.last_activity || loop.started_at,
      });
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
   * Fetch local node status
   */
  private async fetchLocalStatus(): Promise<NodeStatus | null> {
    try {
      const response = await fetch(`http://${LOCALHOST}:${API_PORT}/api/status`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { data?: NodeStatus };
      return data.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Get current loop snapshots
   */
  getSnapshots(): Map<string, RalphLoopStateSnapshot> {
    return new Map(this.loopSnapshots);
  }
}
