// Ralph Loop Management Service

import { promises as fsp } from "fs";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import type { RalphLoop, RalphLoopStateFile, CreateRalphLoopRequest, RalphLoopCommit } from "../types/index";
import { GitService } from "./git";

const execAsync = promisify(exec);

// Configuration
const NODE_AGENT_DIR = path.join(process.env.HOME || "", ".node-agent");
const PIDS_DIR = path.join(NODE_AGENT_DIR, "pids");
const LOGS_DIR = path.join(NODE_AGENT_DIR, "logs");

export class RalphService {
  private gitService: GitService;
  private processes: Map<string, number> = new Map();

  constructor() {
    this.gitService = new GitService();
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fsp.mkdir(NODE_AGENT_DIR, { recursive: true });
    await fsp.mkdir(PIDS_DIR, { recursive: true });
    await fsp.mkdir(LOGS_DIR, { recursive: true });
  }

  /**
   * List all Ralph loops (by checking state files and tracking processes)
   */
  async listRalphLoops(): Promise<RalphLoop[]> {
    const worktrees = await this.gitService.listWorktrees();
    const loops: RalphLoop[] = [];

    for (const worktree of worktrees) {
      const stateFile = path.join(worktree.path, ".claude", "ralph-loop.local.md");

      try {
        // Check if state file exists
        const content = await fsp.readFile(stateFile, "utf-8");
        const state = this.parseStateFile(content);

        // Check if process is running
        const pidFile = path.join(PIDS_DIR, `${worktree.id}.pid`);
        let processId: number | undefined;
        let status: "running" | "complete" | "stopped" = "stopped";

        if (await this.fileExists(pidFile)) {
          const pid = parseInt(await fsp.readFile(pidFile, "utf-8"), 10);
          if (await this.isProcessRunning(pid)) {
            processId = pid;
            status = "running";
          } else {
            // Process ended but state file exists = complete
            status = "complete";
            // Clean up stale PID file
            await fsp.unlink(pidFile);
          }
        } else if (state.active) {
          // State file says active but no PID file = orphaned
          status = "stopped";
        }

        // Get recent commits
        const recentCommits = await this.gitService.getRecentCommits(worktree.path, 5);

        loops.push({
          id: worktree.id,
          worktree_id: worktree.id,
          status,
          prompt: state.prompt,
          iteration: state.iteration,
          max_iterations: state.max_iterations,
          completion_promise: state.completion_promise,
          started_at: state.started_at,
          process_id,
          recent_commits: recentCommits,
        });
      } catch {
        // No state file, skip
        continue;
      }
    }

    return loops;
  }

  /**
   * Get a specific Ralph loop by ID
   */
  async getRalphLoop(loopId: string): Promise<RalphLoop | null> {
    const loops = await this.listRalphLoops();
    return loops.find((loop) => loop.id === loopId) || null;
  }

  /**
   * Start a new Ralph loop
   */
  async startRalphLoop(request: CreateRalphLoopRequest): Promise<RalphLoop> {
    const worktrees = await this.gitService.listWorktrees();
    const worktree = worktrees.find((w) => w.id === request.worktree_id);

    if (!worktree) {
      throw new Error("WORKTREE_NOT_FOUND");
    }

    const loopId = worktree.id;
    const stateFile = path.join(worktree.path, ".claude", "ralph-loop.local.md");
    const pidFile = path.join(PIDS_DIR, `${loopId}.pid`);
    const logFile = path.join(LOGS_DIR, `${loopId}.log`);

    // Check if already running
    if (await this.fileExists(pidFile)) {
      const pid = parseInt(await fsp.readFile(pidFile, "utf-8"), 10);
      if (await this.isProcessRunning(pid)) {
        throw new Error("RALPH_LOOP_ALREADY_RUNNING");
      }
    }

    // Create Ralph loop state file
    const stateContent: RalphLoopStateFile = {
      active: true,
      iteration: 0,
      max_iterations: request.max_iterations || 0,
      completion_promise: request.completion_promise || null,
      started_at: new Date().toISOString(),
      prompt: request.prompt,
    };

    const stateFileContent = this.formatStateFile(stateContent);
    await fsp.writeFile(stateFile, stateFileContent);

    // Create .claude/settings.local.json with permissions
    const settingsFile = path.join(worktree.path, ".claude", "settings.local.json");
    const settingsContent = {
      permissions: {
        allow: [
          "Skill(ralph-loop:ralph-loop)",
          "Bash(git:*)",
          "Bash(bun:*)",
          "Bash(npm:*)",
          "Bash(curl:*)",
          "Bash(node:*)",
          "Bash(python:*)",
          "Bash(python3:*)",
        ],
      },
    };
    await fsp.writeFile(settingsFile, JSON.stringify(settingsContent, null, 2));

    // Start Claude Code process
    const dopplerProject = process.env.DOPPLER_PROJECT || "seed";
    const dopplerConfig = process.env.DOPPLER_CONFIG || "prd";

    const args = [
      "run",
      "--project",
      dopplerProject,
      "--config",
      dopplerConfig,
      "--",
      "claude",
    ];

    const options = {
      cwd: worktree.path,
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
    };

    const child = spawn("doppler", args, options);
    child.unref();

    // Wait a moment to ensure it started
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!child.pid) {
      throw new Error("PROCESS_START_FAILED");
    }

    // Save PID
    await fsp.writeFile(pidFile, child.pid.toString());
    this.processes.set(loopId, child.pid);

    // Log the start
    const logEntry = `[${new Date().toISOString()}] Started Ralph loop with PID: ${child.pid}\n`;
    await fsp.appendFile(logFile, logEntry);

    return {
      id: loopId,
      worktree_id: request.worktree_id,
      status: "running",
      prompt: request.prompt,
      iteration: 0,
      max_iterations: request.max_iterations || 0,
      completion_promise: request.completion_promise || null,
      started_at: stateContent.started_at,
      process_id: child.pid,
    };
  }

  /**
   * Stop a Ralph loop
   */
  async stopRalphLoop(loopId: string): Promise<void> {
    const worktrees = await this.gitService.listWorktrees();
    const worktree = worktrees.find((w) => w.id === loopId);

    if (!worktree) {
      throw new Error("WORKTREE_NOT_FOUND");
    }

    const pidFile = path.join(PIDS_DIR, `${loopId}.pid`);
    const stateFile = path.join(worktree.path, ".claude", "ralph-loop.local.md");
    const logFile = path.join(LOGS_DIR, `${loopId}.log`);

    // Kill process if running
    if (await this.fileExists(pidFile)) {
      const pid = parseInt(await fsp.readFile(pidFile, "utf-8"), 10);

      try {
        // Try graceful shutdown first
        process.kill(pid, "SIGTERM");

        // Wait a moment
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Force kill if still running
        if (await this.isProcessRunning(pid)) {
          process.kill(pid, "SIGKILL");
        }
      } catch {
        // Process already dead
      }

      await fsp.unlink(pidFile);
      this.processes.delete(loopId);

      const logEntry = `[${new Date().toISOString()}] Stopped Ralph loop (PID: ${pid})\n`;
      await fsp.appendFile(logFile, logEntry);
    }

    // Remove state file (this signals the stop hook to allow exit)
    if (await this.fileExists(stateFile)) {
      await fsp.unlink(stateFile);
    }
  }

  /**
   * Parse Ralph loop state file
   */
  private parseStateFile(content: string): RalphLoopStateFile {
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      throw new Error("INVALID_STATE_FILE");
    }

    const frontmatter = frontmatterMatch[1];
    const prompt = frontmatterMatch[2].trim();

    const state: Partial<RalphLoopStateFile> = {};
    const lines = frontmatter.split("\n");

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        if (key === "active") {
          state.active = value === "true";
        } else if (key === "iteration" || key === "max_iterations") {
          state[key] = parseInt(value, 10);
        } else if (key === "completion_promise") {
          state.completion_promise = value === "null" ? null : value;
        } else if (key === "started_at") {
          state.started_at = value;
        }
      }
    }

    return {
      active: state.active ?? true,
      iteration: state.iteration ?? 0,
      max_iterations: state.max_iterations ?? 0,
      completion_promise: state.completion_promise ?? null,
      started_at: state.started_at ?? new Date().toISOString(),
      prompt: state.prompt || prompt,
    };
  }

  /**
   * Format Ralph loop state file
   */
  private formatStateFile(state: RalphLoopStateFile): string {
    return `---
active: ${state.active}
iteration: ${state.iteration}
max_iterations: ${state.max_iterations}
completion_promise: ${state.completion_promise ?? "null"}
started_at: ${state.started_at}
---

${state.prompt}
`;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a process is running
   */
  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists
      return true;
    } catch {
      return false;
    }
  }
}
