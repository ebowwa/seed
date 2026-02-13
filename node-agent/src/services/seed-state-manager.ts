/**
 * Seed State Manager
 *
 * Manages comprehensive state for Seed Node Agent, including:
 * - System identity and machine context
 * - Worktree tracking
 * - Ralph loop monitoring
 * - Self-improvement tracking
 * - Token economics
 * - Work memory (crash recovery)
 * - History and patterns
 * - Health monitoring
 */

import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import {
  type SeedState,
  type WorktreeState,
  type RalphLoopState,
  type SkillState,
  type Action,
  WorktreeStatus,
  RalphStatus,
  SkillStatus,
  type HealthCheck,
  type HealthCheckStatus,
} from "../types/seed-state";

const STATE_DIR = "/root/seed/state";
const STATE_FILE = path.join(STATE_DIR, "seed-state.json");
const MAX_HISTORY_ACTIONS = 1000;
const STATE_VERSION = "2.0.0";

export class SeedStateManager {
  private state: SeedState | null = null;
  private stateDir: string;
  private stateFile: string;
  private nodeId: string;
  private initialized: boolean = false;

  constructor(stateDir?: string) {
    this.stateDir = stateDir || STATE_DIR;
    this.stateFile = path.join(this.stateDir, "seed-state.json");
    this.nodeId = os.hostname();
  }

  /**
   * Initialize state manager - load existing state or create new
   */
  async initialize(): Promise<void> {
    try {
      // Ensure state directory exists
      await fs.mkdir(this.stateDir, { recursive: true });

      // Try to load existing state
      const stateData = await fs.readFile(this.stateFile, "utf-8");
      this.state = JSON.parse(stateData);

      // Validate and upgrade state if needed
      if (this.state.version !== STATE_VERSION) {
        console.log(`[SeedStateManager] Upgrading state from ${this.state.version} to ${STATE_VERSION}`);
        this.state = await this.upgradeState(this.state);
      }

      console.log(`[SeedStateManager] Loaded state for node: ${this.state.nodeId}`);
      this.logAction("state_loaded", "seed-state.json", "success");

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // No existing state - create new
        this.state = await this.createInitialState();
        await this.saveState();
        console.log(`[SeedStateManager] Created new state for node: ${this.nodeId}`);
      } else {
        console.error(`[SeedStateManager] Error loading state:`, error);
        throw error;
      }
    }

    this.initialized = true;
  }

  /**
   * Create initial state structure
   */
  private async createInitialState(): Promise<SeedState> {
    const now = new Date().toISOString();

    return {
      version: STATE_VERSION,
      nodeId: this.nodeId,
      initializedAt: now,
      lastUpdated: now,

      // Worktrees and Ralph loops start empty
      worktrees: {},
      ralphLoops: {},

      // Self-improvement
      selfImprovement: {
        skills: {},
      },

      // History
      history: {
        actions: [],
        totalActions: 0,
        patterns: {},
        failures: {},
      },

      // Health
      health: {
        lastCheck: now,
        checks: {},
        issues: [],
      },
    };
  }

  /**
   * Upgrade state from older versions
   */
  private async upgradeState(oldState: any): Promise<SeedState> {
    // Add missing fields with defaults
    const upgraded: SeedState = {
      ...oldState,
      version: STATE_VERSION,
      lastUpdated: new Date().toISOString(),
    };

    // Ensure worktrees exists
    if (!upgraded.worktrees) {
      upgraded.worktrees = {};
    }

    // Ensure ralphLoops exists
    if (!upgraded.ralphLoops) {
      upgraded.ralphLoops = {};
    }

    // Ensure selfImprovement exists
    if (!upgraded.selfImprovement) {
      upgraded.selfImprovement = { skills: {} };
    }

    // Ensure history exists
    if (!upgraded.history) {
      upgraded.history = {
        actions: [],
        totalActions: 0,
        patterns: {},
        failures: {},
      };
    }

    // Ensure health exists
    if (!upgraded.health) {
      upgraded.health = {
        lastCheck: new Date().toISOString(),
        checks: {},
        issues: [],
      };
    }

    return upgraded;
  }

  /**
   * Save state to disk
   */
  async saveState(): Promise<void> {
    if (!this.state) {
      throw new Error("State not initialized");
    }

    this.state.lastUpdated = new Date().toISOString();

    // Trim history if too long
    if (this.state.history.actions.length > MAX_HISTORY_ACTIONS) {
      this.state.history.actions = this.state.history.actions.slice(-MAX_HISTORY_ACTIONS);
    }

    await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2), "utf-8");
    this.logAction("state_saved", "seed-state.json", "success");
  }

  /**
   * Get current state
   */
  getState(): SeedState | null {
    return this.state;
  }

  /**
   * Update machine context
   */
  async updateMachineContext(): Promise<void> {
    if (!this.state) throw new Error("State not initialized");

    const cpuInfo = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const platform = os.platform();
    const arch = os.arch();

    // Determine tiers based on capacity
    const cpuTier = cpuInfo.length >= 8 ? "high" : cpuInfo.length >= 4 ? "medium" : "low";
    const memTier = totalMem >= 16 * 1024 * 1024 * 1024 ? "high" : totalMem >= 8 * 1024 * 1024 * 1024 ? "medium" : "low";

    // Get disk info
    const diskInfo = await this.getDiskInfo();

    this.state.machine = {
      cpu: {
        count: cpuInfo.length,
        model: cpuInfo[0]?.model || "unknown",
        tier: cpuTier,
      },
      memory: {
        total: totalMem,
        available: freeMem,
        tier: memTier,
      },
      disk: diskInfo,
      platform: {
        os: platform,
        arch: arch,
        isContainer: await this.isRunningInContainer(),
      },
    };

    // Calculate overall capacity score
    this.state.machine.score = this.calculateCapacityScore();
    this.state.machine.capacity = this.getCapacityTier(this.state.machine.score);
  }

  /**
   * Get disk information
   */
  private async getDiskInfo(): Promise<{ total: number; available: number; tier: string }> {
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      const { stdout } = await execAsync("df -B1 /root | tail -1");
      const parts = stdout.trim().split(/\s+/);

      const total = parseInt(parts[1], 10);
      const available = parseInt(parts[3], 10);

      const tier = total >= 100 * 1024 * 1024 * 1024 ? "high" : total >= 50 * 1024 * 1024 * 1024 ? "medium" : "low";

      return { total, available, tier };
    } catch (error) {
      console.error("[SeedStateManager] Error getting disk info:", error);
      return { total: 0, available: 0, tier: "unknown" };
    }
  }

  /**
   * Check if running in container
   */
  private async isRunningInContainer(): Promise<boolean> {
    try {
      const { access } = fs;
      await access("/.dockerenv");
      return true;
    } catch {
      // Check for containerd/cgroup markers
      try {
        const { readFile } = fs;
        const cgroup = await readFile("/proc/1/cgroup", "utf-8");
        return cgroup.includes("docker") || cgroup.includes("kubepods") || cgroup.includes("containerd");
      } catch {
        return false;
      }
    }
  }

  /**
   * Calculate capacity score (0-100)
   */
  private calculateCapacityScore(): number {
    if (!this.state?.machine) return 0;

    const { cpu, memory, disk } = this.state.machine;

    // Score each component
    const cpuScore = Math.min(cpu.count * 10, 100);
    const memScore = Math.min((memory.total / (16 * 1024 * 1024 * 1024)) * 100, 100);
    const diskScore = Math.min((disk.total / (100 * 1024 * 1024 * 1024)) * 100, 100);

    return Math.round((cpuScore + memScore + diskScore) / 3);
  }

  /**
   * Get capacity tier from score
   */
  private getCapacityTier(score: number): string {
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  /**
   * Update network information
   */
  async updateNetworkInfo(): Promise<void> {
    if (!this.state) throw new Error("State not initialized");

    // Get Tailscale IP
    const tailscaleIP = await this.getTailscaleIP();
    const tailscaleHostname = await this.getTailscaleHostname();
    const uptime = os.uptime();

    this.state.network = {
      tailscaleIP,
      tailscaleHostname,
      uptime,
    };

    // Get public IP
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      const { stdout } = await execAsync("curl -s ifconfig.me");
      this.state.network.publicIP = stdout.trim();
    } catch (error) {
      // Public IP not critical
    }
  }

  /**
   * Get Tailscale IP
   */
  private async getTailscaleIP(): Promise<string | undefined> {
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      const { stdout } = await execAsync("tailscale ip -4");
      const ip = stdout.trim().split("\n")[0];
      return ip || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get Tailscale hostname
   */
  private async getTailscaleHostname(): Promise<string | undefined> {
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      const { stdout } = await execAsync("tailscale status --json");
      const status = JSON.parse(stdout);
      return status.Self?.HostName;
    } catch {
      return undefined;
    }
  }

  /**
   * Add or update a worktree
   */
  upsertWorktree(worktree: WorktreeState): void {
    if (!this.state) throw new Error("State not initialized");

    this.state.worktrees[worktree.id] = worktree;
    this.logAction("worktree_created", worktree.id, "success");
  }

  /**
   * Update worktree status
   */
  updateWorktreeStatus(worktreeId: string, status: WorktreeStatus): void {
    if (!this.state) throw new Error("State not initialized");

    if (this.state.worktrees[worktreeId]) {
      this.state.worktrees[worktreeId].status = status;
      this.state.worktrees[worktreeId].lastActive = new Date().toISOString();
    }
  }

  /**
   * Remove worktree
   */
  removeWorktree(worktreeId: string): void {
    if (!this.state) throw new Error("State not initialized");

    delete this.state.worktrees[worktreeId];
    this.logAction("worktree_deleted", worktreeId, "success");
  }

  /**
   * Add or update a Ralph loop
   */
  upsertRalphLoop(loop: RalphLoopState): void {
    if (!this.state) throw new Error("State not initialized");

    this.state.ralphLoops[loop.id] = loop;
    this.logAction("ralph_loop_started", loop.id, "success");

    // Link to worktree if specified
    if (loop.worktreeId && this.state.worktrees[loop.worktreeId]) {
      this.state.worktrees[loop.worktreeId].ralphLoopId = loop.id;
    }
  }

  /**
   * Update Ralph loop status
   */
  updateRalphLoopStatus(loopId: string, status: RalphStatus): void {
    if (!this.state) throw new Error("State not initialized");

    if (this.state.ralphLoops[loopId]) {
      this.state.ralphLoops[loopId].status = status;
      this.state.ralphLoops[loopId].lastUpdate = new Date().toISOString();

      if (status === "complete") {
        this.logAction("ralph_loop_completed", loopId, "success");
      } else if (status === "error") {
        this.logAction("ralph_loop_failed", loopId, "failure");
        this.trackFailure(`ralph_loop:${loopId}`);
      } else if (status === "stopped") {
        this.logAction("ralph_loop_stopped", loopId, "success");
      }
    }
  }

  /**
   * Remove Ralph loop
   */
  removeRalphLoop(loopId: string): void {
    if (!this.state) throw new Error("State not initialized");

    const loop = this.state.ralphLoops[loopId];
    if (loop && loop.worktreeId && this.state.worktrees[loop.worktreeId]) {
      this.state.worktrees[loop.worktreeId].ralphLoopId = undefined;
    }

    delete this.state.ralphLoops[loopId];
  }

  /**
   * Update skill state
   */
  upsertSkill(skill: SkillState): void {
    if (!this.state) throw new Error("State not initialized");

    this.state.selfImprovement.skills[skill.id] = skill;
    this.state.selfImprovement.lastUpdate = new Date().toISOString();

    if (skill.status === "passed") {
      this.logAction("skill_passed", skill.id, "success");
    } else if (skill.status === "failed") {
      this.logAction("skill_failed", skill.id, "failure");
      this.trackFailure(`skill:${skill.id}`);
    }
  }

  /**
   * Log an action to history
   */
  private logAction(type: string, target: string, result: "success" | "failure" | "partial", metadata?: Record<string, unknown>): void {
    if (!this.state) return;

    const action: Action = {
      timestamp: new Date().toISOString(),
      type: type as any,
      target,
      result,
      metadata,
    };

    this.state.history.actions.push(action);
    this.state.history.totalActions++;

    // Track patterns
    const pattern = `${type}:${result}`;
    this.state.history.patterns[pattern] = (this.state.history.patterns[pattern] || 0) + 1;
  }

  /**
   * Track a failure
   */
  private trackFailure(pattern: string): void {
    if (!this.state) return;

    this.state.history.failures[pattern] = (this.state.history.failures[pattern] || 0) + 1;
  }

  /**
   * Add token usage
   */
  addTokenUsage(sessionId: string, loopId: string, input: number, output: number): void {
    if (!this.state) throw new Error("State not initialized");

    if (!this.state.tokenUsage) {
      this.state.tokenUsage = {
        totalInput: 0,
        totalOutput: 0,
        bySession: {},
        byLoop: {},
      };
    }

    this.state.tokenUsage.totalInput += input;
    this.state.tokenUsage.totalOutput += output;

    this.state.tokenUsage.bySession[sessionId] = {
      input: (this.state.tokenUsage.bySession[sessionId]?.input || 0) + input,
      output: (this.state.tokenUsage.bySession[sessionId]?.output || 0) + output,
    };

    this.state.tokenUsage.byLoop[loopId] = {
      input: (this.state.tokenUsage.byLoop[loopId]?.input || 0) + input,
      output: (this.state.tokenUsage.byLoop[loopId]?.output || 0) + output,
    };
  }

  /**
   * Update file checksum (work memory)
   */
  async updateFileChecksum(filePath: string, checksum?: string): Promise<void> {
    if (!this.state) throw new Error("State not initialized");

    if (!this.state.workMemory) {
      this.state.workMemory = {
        completedFiles: [],
        fileChecksums: {},
      };
    }

    if (checksum) {
      this.state.workMemory.fileChecksums[filePath] = checksum;
      this.state.workMemory.completedFiles.push(filePath);
    }
  }

  /**
   * Check if file has been processed
   */
  isFileProcessed(filePath: string): boolean {
    if (!this.state?.workMemory) return false;
    return this.state.workMemory.completedFiles.includes(filePath);
  }

  /**
   * Get file checksum
   */
  getFileChecksum(filePath: string): string | undefined {
    return this.state?.workMemory?.fileChecksums[filePath];
  }

  /**
   * Run health checks
   */
  async runHealthChecks(): Promise<void> {
    if (!this.state) throw new Error("State not initialized");

    const checks: HealthCheck[] = [];
    const issues: string[] = [];

    // Check disk space
    if (this.state.machine?.disk) {
      const diskUsagePercent = ((this.state.machine.disk.total - this.state.machine.disk.available) / this.state.machine.disk.total) * 100;

      if (diskUsagePercent > 90) {
        checks.push({ name: "disk_space", status: "error", message: `Disk usage at ${diskUsagePercent.toFixed(1)}%` });
        issues.push("Disk nearly full");
      } else if (diskUsagePercent > 75) {
        checks.push({ name: "disk_space", status: "warning", message: `Disk usage at ${diskUsagePercent.toFixed(1)}%` });
      } else {
        checks.push({ name: "disk_space", status: "ok" });
      }
    }

    // Check memory
    if (this.state.machine?.memory) {
      const memUsagePercent = ((this.state.machine.memory.total - this.state.machine.memory.available) / this.state.machine.memory.total) * 100;

      if (memUsagePercent > 90) {
        checks.push({ name: "memory", status: "error", message: `Memory usage at ${memUsagePercent.toFixed(1)}%` });
        issues.push("Memory nearly exhausted");
      } else if (memUsagePercent > 75) {
        checks.push({ name: "memory", status: "warning", message: `Memory usage at ${memUsagePercent.toFixed(1)}%` });
      } else {
        checks.push({ name: "memory", status: "ok" });
      }
    }

    // Check for orphaned Ralph loops
    const orphanedLoops = Object.values(this.state.ralphLoops).filter(loop => loop.status === "running" || loop.status === "starting");
    // TODO: Validate these loops are actually running by checking .claude/ state files

    // Store health check results
    const healthChecks: Record<string, HealthCheckStatus> = {};
    checks.forEach(check => {
      healthChecks[check.name] = check.status;
    });

    this.state.health = {
      lastCheck: new Date().toISOString(),
      checks: healthChecks,
      issues,
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(): { status: HealthCheckStatus; issues: string[] } {
    if (!this.state?.health) {
      return { status: "unknown", issues: [] };
    }

    const checks = Object.values(this.state.health.checks);

    if (checks.some(c => c === "error")) {
      return { status: "error", issues: this.state.health.issues };
    } else if (checks.some(c => c === "warning")) {
      return { status: "warning", issues: this.state.health.issues };
    } else if (checks.length === 0) {
      return { status: "unknown", issues: [] };
    } else {
      return { status: "ok", issues: [] };
    }
  }

  /**
   * Calculate file checksum (SHA256)
   */
  static async calculateFileChecksum(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return crypto.createHash("sha256").update(content).digest("hex");
    } catch (error) {
      console.error(`[SeedStateManager] Error calculating checksum for ${filePath}:`, error);
      return "";
    }
  }

  /**
   * Scan Ralph loop state files and sync with state
   */
  async syncRalphLoopsFromDisk(baseDir: string = "/root/seed/worktrees"): Promise<void> {
    if (!this.state) throw new Error("State not initialized");

    try {
      const { readdir, readFile } = fs;

      // Scan all worktrees
      const worktreeDirs = await readdir(baseDir, { withFileTypes: true });

      for (const worktreeDir of worktreeDirs) {
        if (!worktreeDir.isDirectory()) continue;

        const worktreePath = path.join(baseDir, worktreeDir.name);
        const claudeDir = path.join(worktreePath, ".claude");

        try {
          // Scan for Ralph state files
          const claudeFiles = await readdir(claudeDir);

          for (const file of claudeFiles) {
            if (!file.startsWith(".ralph-iterative.") || !file.endsWith(".json")) continue;

            const stateFilePath = path.join(claudeDir, file);
            const stateContent = await readFile(stateFilePath, "utf-8");
            const ralphState = JSON.parse(stateContent);

            // Extract loop ID from filename
            const loopId = file.replace(".ralph-iterative.", "").replace(".json", "");

            // Determine actual status
            let status: RalphStatus = ralphState.status || "running";
            if (status === "complete") {
              status = "complete";
            } else if (status === "error") {
              status = "error";
            } else {
              // Check if the process is still running
              // For now, assume it's orphaned if not complete/error
              status = "orphaned";
            }

            // Create or update loop state
            this.state.ralphLoops[loopId] = {
              id: loopId,
              worktreeId: worktreeDir.name,
              prompt: ralphState.prompt,
              promise: ralphState.promise,
              iteration: ralphState.iteration || 0,
              startTime: ralphState.startTime,
              lastUpdate: ralphState.lastUpdate || ralphState.startTime,
              phase: ralphState.slam?.phase,
              status,
              subtasks: ralphState.slam?.subtasks,
              filesChanged: ralphState.filesChanged,
              tokens: ralphState.tokens,
              stateFilePath,
            };
          }
        } catch (error) {
          // Worktree may not have .claude directory
          continue;
        }
      }

      console.log(`[SeedStateManager] Synced ${Object.keys(this.state.ralphLoops).length} Ralph loops from disk`);
    } catch (error) {
      console.error("[SeedStateManager] Error syncing Ralph loops:", error);
    }
  }
}

// Singleton instance
let stateManagerInstance: SeedStateManager | null = null;

export function getStateManager(): SeedStateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new SeedStateManager();
  }
  return stateManagerInstance;
}
