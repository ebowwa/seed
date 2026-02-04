// Ralph Loop Management Service

import { promises as fsp } from "fs";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import type {
  RalphLoop,
  RalphLoopStateFile,
  RalphIterativeStateFile,
  CreateRalphLoopRequest,
  RalphLoopCommit,
} from "@ebowwa/codespaces-types/compile";
import { GitService } from "./git";
import { ConsoleLoggerService } from "./console-logger";

const execAsync = promisify(exec);

// Configuration
const NODE_AGENT_DIR = path.join(process.env.HOME || "", ".node-agent");
const PIDS_DIR = path.join(NODE_AGENT_DIR, "pids");
const LOGS_DIR = path.join(NODE_AGENT_DIR, "logs");

// Directories to scan for Ralph Iterative state files
const RALPH_SCAN_DIRS = [
  path.join(process.env.HOME || "", "seed"), // Main seed directory
  path.join(process.env.HOME || "", "seed", "worktrees"), // Worktrees
];

export class RalphService {
  private gitService: GitService;
  private consoleLogger: ConsoleLoggerService;
  private pids: Map<string, number> = new Map();
  private activeProcesses: Map<string, { process: ReturnType<typeof spawn>, stdout: Readable, stdin: Writable }> = new Map();

  constructor() {
    this.gitService = new GitService();
    this.consoleLogger = new ConsoleLoggerService();
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fsp.mkdir(NODE_AGENT_DIR, { recursive: true });
    await fsp.mkdir(PIDS_DIR, { recursive: true });
    await fsp.mkdir(LOGS_DIR, { recursive: true });
  }

  /**
   * List all Ralph loops (by checking state files and tracking processes)
   *
   * Scans for:
   * 1. .claude/.ralph-iterative.*.json files (new Ralph Iterative skill)
   * 2. .claude/ralph-loop.local.md files (legacy format)
   *
   * TODO: Add caching for Ralph state files to avoid repeated disk reads
   * TODO: Consider using fs.watch() for real-time updates instead of polling
   */
  async listRalphLoops(): Promise<RalphLoop[]> {
    const loops: RalphLoop[] = [];

    // Get actively running Claude Code processes (by checking activeProcesses Map)
    const runningProcessIds = Array.from(this.activeProcesses.keys());

    // Scan for Ralph Iterative JSON state files
    const iterativeFiles = await this.findRalphIterativeStateFiles();

    for (const { filePath, projectName } of iterativeFiles) {
      try {
        const content = await fsp.readFile(filePath, "utf-8");
        const state: RalphIterativeStateFile = JSON.parse(content);

        // Determine status from SLAM phase AND whether process is actually running
        let status: "starting" | "running" | "complete" | "error" | "stopped" = "stopped";
        const loopId = `${projectName}-${state.iteration}`;
        const isProcessRunning = this.activeProcesses.has(loopId) ||
                                 (this.pids.get(loopId) && await this.isProcessRunning(this.pids.get(loopId)!));

        if (state.slam?.phase === "complete") {
          status = "complete";
        } else if (state.slam?.phase === "planning") {
          status = isProcessRunning ? "starting" : "stopped";
        } else if (isProcessRunning) {
          status = "running";
        }

        // Skip loops that are complete AND not running (cleanup old completed loops)
        if (status === "complete" && !isProcessRunning) {
          // Optionally: delete old state files for completed loops
          // await fsp.unlink(filePath);
          continue;
        }

        // Skip stopped loops unless they're the most recent one for this project
        if (status === "stopped") {
          continue;
        }

        // Generate ID from project name and file path
        const id = loopId;

        // Extract subtask info
        const subtasks = state.slam?.subtasks || [];
        const totalSubtasks = subtasks.length;
        const completedSubtasks = state.slam?.completedSubtasks?.length || 0;

        // Find current subtask
        const currentSubtaskId = state.slam?.currentSubtask;
        const currentSubtask = subtasks.find((st) => st.id === currentSubtaskId);

        // Get project directory (parent of .claude folder)
        const projectDir = path.dirname(path.dirname(filePath));
        const homeDir = process.env.HOME || "";
        // Format as relative path: ~/seed or ~/seed/worktrees/feature-x
        let projectPath = projectDir;
        if (projectDir.startsWith(homeDir)) {
          projectPath = "~" + projectDir.slice(homeDir.length);
        }

        // Get git info (remote and branch)
        const gitInfo = await this.getGitInfo(projectDir);

        // Get PID if process is running
        const processId = this.pids.get(id);

        loops.push({
          id,
          worktree_id: projectName,
          status,
          prompt: state.prompt,
          iteration: state.iteration,
          max_iterations: 0, // Ralph Iterative doesn't use max_iterations
          completion_promise: state.promise || null,
          started_at: state.startTime,
          last_activity: state.lastUpdate,
          process_id,
          project_path: projectPath,
          git_info: gitInfo,
          // Ralph Iterative specific fields
          phase: state.slam?.phase,
          current_task: currentSubtask?.title || state.slam?.state?.currentTask,
          total_subtasks: totalSubtasks,
          completed_subtasks: completedSubtasks,
          subtasks: subtasks.map((st) => ({
            id: st.id,
            title: st.title,
            status: st.status,
          })),
        });
      } catch {
        // Invalid JSON or other error, skip
        continue;
      }
    }

    // Also scan for legacy markdown state files in worktrees
    const worktrees = await this.gitService.listWorktrees();

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

        // Skip complete and stopped loops - only return actively running loops
        if (status === "stopped") {
          continue;
        }

        // For complete loops, only include if they just finished recently (last 5 minutes)
        if (status === "complete") {
          const now = Date.now();
          const completedAt = new Date(state.started_at).getTime();
          const hoursSinceComplete = (now - completedAt) / (1000 * 60 * 60);
          if (hoursSinceComplete > 0.1) { // 6 minutes
            continue; // Skip old completed loops
          }
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
   * Find all Ralph Iterative state files (.claude/.ralph-iterative.*.json)
   * by scanning configured directories recursively
   */
  private async findRalphIterativeStateFiles(): Promise<
    Array<{ filePath: string; projectName: string }>
  > {
    const results: Array<{ filePath: string; projectName: string }> = [];

    for (const scanDir of RALPH_SCAN_DIRS) {
      try {
        await this.scanDirectoryForRalphFiles(scanDir, results);
      } catch {
        // Directory doesn't exist or isn't accessible, skip
        continue;
      }
    }

    return results;
  }

  /**
   * Recursively scan a directory for .claude/.ralph-iterative.*.json files
   */
  private async scanDirectoryForRalphFiles(
    dirPath: string,
    results: Array<{ filePath: string; projectName: string }>,
  ): Promise<void> {
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden dirs (except .claude)
          if (entry.name === "node_modules" || (entry.name.startsWith(".") && entry.name !== ".claude")) {
            continue;
          }
          // Recursively scan subdirectories
          await this.scanDirectoryForRalphFiles(fullPath, results);
        } else if (entry.name.startsWith(".ralph-iterative.") && entry.name.endsWith(".json")) {
          // Found a Ralph Iterative state file!
          // Determine project name from parent directory or path
          const parentDir = path.basename(dirPath);
          const projectName = parentDir === ".claude" ? path.basename(path.dirname(dirPath)) : parentDir;

          results.push({
            filePath: fullPath,
            projectName,
          });
        }
      }
    } catch {
      // Directory not accessible, skip
    }
  }

  /**
   * Get a specific Ralph loop by ID
   */
  async getRalphLoop(loopId: string): Promise<RalphLoop | null> {
    const loops = await this.listRalphLoops();
    return loops.find((loop) => loop.id === loopId) || null;
  }

  /**
   * Start a new Ralph loop using Ralph Iterative format
   *
   * Creates .claude/.ralph-iterative.local.json with SLAM state
   * and spawns Claude Code which will detect the file and start iterating.
   */
  async startRalphLoop(request: CreateRalphLoopRequest): Promise<RalphLoop> {
    const worktrees = await this.gitService.listWorktrees();
    const worktree = worktrees.find((w) => w.id === request.worktree_id);

    if (!worktree) {
      throw new Error("WORKTREE_NOT_FOUND");
    }

    const loopId = worktree.id;
    const pidFile = path.join(PIDS_DIR, `${loopId}.pid`);
    const logFile = path.join(LOGS_DIR, `${loopId}.log`);
    const stateFilePath = path.join(
      worktree.path,
      ".claude",
      ".ralph-iterative.local.json",
    );

    // Check if already running
    if (await this.fileExists(pidFile)) {
      const pid = parseInt(await fsp.readFile(pidFile, "utf-8"), 10);
      if (await this.isProcessRunning(pid)) {
        throw new Error("RALPH_LOOP_ALREADY_RUNNING");
      }
    }

    // Check if state file already exists (Ralph Iterative session already active)
    if (await this.fileExists(stateFilePath)) {
      throw new Error("RALPH_ITERATIVE_ALREADY_ACTIVE");
    }

    // Detect machine resources
    const machineInfo = await this.detectMachineResources();

    // Create Ralph Iterative state file
    const now = new Date().toISOString();
    const stateContent = {
      prompt: request.prompt,
      promise: request.completion_promise || "TASK_COMPLETE",
      iteration: 0,
      startTime: now,
      lastUpdate: now,
      tokens: {
        totalInput: 0,
        totalOutput: 0,
        byIteration: [],
      },
      filesChanged: [],
      workMemory: {
        completedFiles: [],
        fileChecksums: {},
      },
      machine: machineInfo,
      git: {
        enabled: request.auto_commit || request.auto_pr || false,
        autoCommit: request.auto_commit || request.auto_pr || false,
        autoPR: request.auto_pr || false,
        baseBranch: request.base_branch || "main",
        useLane: false,
        useWorktree: true,
        laneName: "",
        lanePath: "",
        laneCreated: false,
        branchCreated: false,
        branchName: "",
        currentCommit: "",
      },
      slam: {
        enabled: request.enable_subagents || false,
        phase: "planning",
        state: {
          currentTask: request.prompt,
          beliefs: {},
          goals: [request.completion_promise || "TASK_COMPLETE"],
        },
        subtasks: [],
        currentSubtask: null,
        completedSubtasks: [],
        memory: {
          actionsTaken: [],
          outcomes: {},
          patterns: {},
        },
      },
      subagents: {
        enabled: request.enable_subagents || false,
        available: [
          "planner",
          "executor",
          "reviewer",
          "fixer",
          "git",
          "reporter",
          "paranoid",
          "healer",
          "manager",
        ],
        active: [],
      },
    };

    // Ensure .claude directory exists
    const claudeDir = path.join(worktree.path, ".claude");
    await fsp.mkdir(claudeDir, { recursive: true });

    // Write Ralph Iterative state file
    await fsp.writeFile(
      stateFilePath,
      JSON.stringify(stateContent, null, 2),
    );

    // Create .claude/settings.local.json with Ralph Iterative permissions
    const settingsFile = path.join(worktree.path, ".claude", "settings.local.json");
    const settingsContent = {
      permissions: {
        allow: [
          "Skill(ralph-iterative:ralph-iterative)",
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

    // Start Claude Code process with piped stdio for WebSocket oversight
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

    // Use piped stdio to capture stdout/stdin for WebSocket streaming
    // Note: Don't use detached mode since we need to keep process handles
    const options = {
      cwd: worktree.path,
      stdio: ["pipe", "pipe", "pipe"] as const,
    };

    const child = spawn("doppler", args, options);

    if (!child.pid || !child.stdin || !child.stdout) {
      throw new Error("PROCESS_START_FAILED");
    }

    // Store process handle for WebSocket access
    this.activeProcesses.set(loopId, {
      process: child,
      stdout: child.stdout,
      stdin: child.stdin,
    });

    // Handle process exit - cleanup
    child.on("exit", (code) => {
      console.log(`[RalphService] Loop ${loopId} exited with code ${code}`);
      this.consoleLogger.logProcessStop(child.pid);
      this.pids.delete(loopId);
      this.activeProcesses.delete(loopId);
    });

    child.on("error", (err) => {
      console.error(`[RalphService] Loop ${loopId} error:`, err);
      this.consoleLogger.logProcessStop(child.pid);
      this.pids.delete(loopId);
      this.activeProcesses.delete(loopId);
    });

    // Wait a moment to ensure it started
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Save PID
    await fsp.writeFile(pidFile, child.pid.toString());
    this.pids.set(loopId, child.pid);

    // Log the start with console logger
    this.consoleLogger.logProcessStart(child.pid, worktree.id, loopId);

    // Also log to file
    const logEntry = `[${new Date().toISOString()}] Started Ralph Iterative loop with PID: ${child.pid}\n`;
    await fsp.appendFile(logFile, logEntry);

    return {
      id: loopId,
      worktree_id: request.worktree_id,
      status: "running",
      prompt: request.prompt,
      iteration: 0,
      max_iterations: 0,
      completion_promise: request.completion_promise || null,
      started_at: now,
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
      this.pids.delete(loopId);
      this.activeProcesses.delete(loopId);

      // Log the stop with console logger
      this.consoleLogger.logProcessStop(pid);

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

  /**
   * Get git remote and branch info for a directory
   */
  private async getGitInfo(projectDir: string): Promise<{
    remote: string | null;
    branch: string | null;
  }> {
    try {
      // Get current branch
      let branch: string | null = null;
      try {
        const { stdout: branchOutput } = await execAsync(
          `cd "${projectDir}" && git rev-parse --abbrev-ref HEAD`,
        );
        branch = branchOutput.trim() || null;
      } catch {
        branch = null;
      }

      // Get remote URL (origin)
      let remote: string | null = null;
      try {
        const { stdout: remoteOutput } = await execAsync(
          `cd "${projectDir}" && git config --get remote.origin.url`,
        );
        const remoteUrl = remoteOutput.trim();
        // Extract owner/repo from URL (handles both https and ssh)
        // https://github.com/ebowwa/seed.git -> ebowwa/seed
        // git@github.com:ebowwa/seed.git -> ebowwa/seed
        const match = remoteUrl.match(/[:/]([^\/]+\/[^\/\.]+)(\.git)?$/);
        remote = match ? match[1] : remoteUrl || null;
      } catch {
        remote = null;
      }

      return { remote, branch };
    } catch {
      return { remote: null, branch: null };
    }
  }

  /**
   * Detect machine resources for Ralph Iterative SLAM
   */
  private async detectMachineResources(): Promise<{
    cpu: { count: number; model: string; tier: string };
    memory: { total: number; free: number; tier: string };
    disk: { total: number; available: number; tier: string };
    platform: { os: string; arch: string; isContainer: boolean };
    capacity: string;
    score: number;
  }> {
    const os = require("os");

    // CPU info
    const cpuCount = os.cpus().length;
    const cpuModel = os.cpus()[0]?.model || "Unknown";
    let cpuTier = "low";
    if (cpuCount >= 16) cpuTier = "high";
    else if (cpuCount >= 8) cpuTier = "medium";

    // Memory info (in GB)
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const totalMemGB = Math.round(totalMem / (1024 ** 3));
    let memTier = "low";
    if (totalMemGB >= 32) memTier = "high";
    else if (totalMemGB >= 16) memTier = "medium";

    // Disk info
    let diskTotal = 0;
    let diskAvailable = 0;
    let diskTier = "low";
    try {
      const { stdout: dfOutput } = await execAsync("df -h / | tail -1");
      const parts = dfOutput.trim().split(/\s+/);
      // Parse size (e.g., "100G" -> 100 GB)
      const sizeStr = parts[1];
      const availStr = parts[3];
      diskTotal = this.parseSizeToGB(sizeStr);
      diskAvailable = this.parseSizeToGB(availStr);
      if (diskTotal >= 500) diskTier = "high";
      else if (diskTotal >= 200) diskTier = "medium";
    } catch {
      // Fallback values
      diskTotal = 100;
      diskAvailable = 50;
    }

    // Platform info
    const platform = {
      os: os.type(),
      arch: os.arch(),
      isContainer: await this.checkIfContainer(),
    };

    // Calculate capacity score (0-100)
    const cpuScore = Math.min((cpuCount / 32) * 30, 30);
    const memScore = Math.min((totalMemGB / 128) * 30, 30);
    const diskScore = Math.min((diskTotal / 1000) * 20, 20);
    const bonusScore = platform.isContainer ? 10 : 5;
    const score = Math.round(cpuScore + memScore + diskScore + bonusScore);

    // Capacity tier
    let capacity = "low";
    if (score >= 70) capacity = "high";
    else if (score >= 40) capacity = "medium";

    return {
      cpu: { count: cpuCount, model: cpuModel, tier: cpuTier },
      memory: { total: totalMemGB, free: Math.round(freeMem / (1024 ** 3)), tier: memTier },
      disk: { total: diskTotal, available: diskAvailable, tier: diskTier },
      platform,
      capacity,
      score,
    };
  }

  /**
   * Check if running in a container
   */
  private async checkIfContainer(): Promise<boolean> {
    try {
      // Check for Docker/.dockerenv
      await execAsync("test -f /.dockerenv");
      return true;
    } catch {
      // Not Docker, check for containerd cgroup
      try {
        const { stdout } = await execAsync("cat /proc/1/cgroup");
        return stdout.includes("docker") || stdout.includes("containerd");
      } catch {
        return false;
      }
    }
  }

  /**
   * Parse size string to GB (e.g., "100G" -> 100, "500M" -> 0.5)
   */
  private parseSizeToGB(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)([KMGT]?)(i?B?)?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case "T": return value * 1024;
      case "G": return value;
      case "M": return value / 1024;
      case "K": return value / (1024 * 1024);
      default: return value;
    }
  }

  /**
   * Get process handle for WebSocket oversight
   * Returns { stdin, stdout } for bidirectional communication with a running Ralph loop
   */
  getProcess(loopId: string): { process: ReturnType<typeof spawn>, stdout: Readable, stdin: Writable } | undefined {
    return this.activeProcesses.get(loopId);
  }
}
