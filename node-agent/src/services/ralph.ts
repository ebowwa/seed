// Ralph Loop Management Service (Branch-based, single active loop)

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
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);

// Configuration
const NODE_AGENT_DIR = path.join(process.env.HOME || "", ".node-agent");
const PIDS_DIR = path.join(NODE_AGENT_DIR, "pids");
const LOGS_DIR = path.join(NODE_AGENT_DIR, "logs");
const REPO_PATH = path.join(process.env.HOME || "", "repos", "main-repo");

// Directories to scan for Ralph Iterative state files
const RALPH_SCAN_DIRS = [
  path.join(process.env.HOME || "", "seed"), // Main seed directory
  path.join(process.env.HOME || "", "repos", "main-repo"), // Main repo
];

export class RalphService {
  private gitService: GitService;
  private consoleLogger: ConsoleLoggerService;
  private pids: Map<string, number> = new Map();
  private activeProcesses: Map<string, { process: ReturnType<typeof spawn>, stdout: Readable, stdin: Writable }> = new Map();
  private activeLoopLock: string | null = null; // Only ONE Ralph loop at a time!

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
   * Check if another Ralph loop is currently running
   */
  isLoopActive(): boolean {
    return this.activeLoopLock !== null;
  }

  /**
   * Get the active loop ID
   */
  getActiveLoop(): string | null {
    return this.activeLoopLock;
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
        const currentSubtask = subtasks.find(s => !state.slam?.completedSubtasks?.includes(s.id));

        // Get current branch name
        const branchName = state.git?.branchName || "unknown";

        loops.push({
          id,
          worktree_id: projectName, // Renamed from worktree_id but keeping API compat
          branch_name: branchName,
          status,
          created_at: state.startTime || new Date().toISOString(),
          updated_at: state.lastUpdate || new Date().toISOString(),
          prompt: state.prompt,
          completion_promise: state.promise,
          iteration: state.iteration,
          total_subtasks: totalSubtasks,
          completed_subtasks: completedSubtasks,
          current_subtask: currentSubtask?.title || currentSubtask?.description || "None",
          slam_phase: state.slam?.phase || "planning",
          tokens: state.tokens,
          files_changed: state.filesChanged,
          machine: state.machine,
        });
      } catch (error) {
        console.error(`Failed to parse state file ${filePath}:`, error);
      }
    }

    // Sort by creation date (newest first)
    loops.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return loops;
  }

  /**
   * Start a new Ralph loop (creates branch, spawns process)
   * NOTE: Only ONE loop can run at a time!
   */
  async startRalphLoop(request: CreateRalphLoopRequest): Promise<RalphLoop> {
    // Check if another loop is already running
    if (this.activeLoopLock !== null) {
      throw new Error("RALPH_LOOP_ALREADY_RUNNING: Only one Ralph loop at a time. Use DELETE /api/ralph-loops/:id to stop the active loop first.");
    }

    // Generate loop ID
    const loopId = request.worktree_id || `ralph-${Date.now()}`;
    const branchName = `feature/ralph-${loopId}`;
    const baseBranch = request.base_branch || "main";

    // Create branch
    const createResult = await this.gitService.createBranch({
      id: loopId,
      branch: baseBranch,
      repository_url: request.repository_url,
    });

    // Acquire lock
    this.activeLoopLock = loopId;

    // Setup paths
    const pidFile = path.join(PIDS_DIR, `${loopId}.pid`);
    const logFile = path.join(LOGS_DIR, `${loopId}.log`);
    const stateFilePath = path.join(REPO_PATH, ".claude", ".ralph-iterative.local.json");

    // Check if already running
    if (await this.fileExists(pidFile)) {
      const pid = parseInt(await fsp.readFile(pidFile, "utf-8"), 10);
      if (await this.isProcessRunning(pid)) {
        this.activeLoopLock = null; // Release lock
        throw new Error("RALPH_LOOP_ALREADY_RUNNING");
      }
    }

    // Check if state file already exists (Ralph Iterative session already active)
    if (await this.fileExists(stateFilePath)) {
      this.activeLoopLock = null; // Release lock
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
        baseBranch: baseBranch,
        branchName: branchName, // NEW: Track branch name
        useLane: false,
        useWorktree: false, // NEW: Changed to false
        laneName: "",
        lanePath: "",
        laneCreated: false,
        branchCreated: true, // NEW: Always true
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
    const claudeDir = path.join(REPO_PATH, ".claude");
    await fsp.mkdir(claudeDir, { recursive: true });

    // Write Ralph Iterative state file
    await fsp.writeFile(
      stateFilePath,
      JSON.stringify(stateContent, null, 2),
    );

    // Create .claude/settings.local.json with Ralph Iterative permissions
    const settingsFile = path.join(REPO_PATH, ".claude", "settings.local.json");
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

    // Start Claude Code process with rolling API keys and auto-retry
    const dopplerProject = process.env.DOPPLER_PROJECT || "seed";
    const dopplerConfig = process.env.DOPPLER_CONFIG || "prd";

    // Use piped stdio to capture stdout/stdin for WebSocket streaming
    const options = {
      cwd: REPO_PATH, // Changed: Work in main repo path
      stdio: ["pipe", "pipe", "pipe"] as const,
    };

    // Get the path to the rolling-keys-supervisor.ts
    const supervisorPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "lib",
      "rolling-keys-supervisor.ts"
    );

    // Use absolute path to bun to avoid PATH issues when spawned by doppler
    const bunPath = path.join(process.env.HOME || "", ".bun", "bin", "bun");

    // Spawn with rolling keys supervisor
    const args = [
      "run",
      "--project",
      dopplerProject,
      "--config",
      dopplerConfig,
      "--",
      bunPath,
      "run",
      supervisorPath,
    ];

    const child = spawn("doppler", args, options);

    if (!child.pid || !child.stdin || !child.stdout) {
      this.activeLoopLock = null; // Release lock
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

      // Release lock
      this.activeLoopLock = null;

      // Cleanup
      this.pids.delete(loopId);
      this.activeProcesses.delete(loopId);
    });

    child.on("error", (err) => {
      console.error(`[RalphService] Loop ${loopId} error:`, err);
      this.activeLoopLock = null; // Release lock
    });

    // Write PID file
    await fsp.writeFile(pidFile, child.pid.toString());

    // Update console logger
    this.consoleLogger.logProcessStart(child.pid, `ralph-loop-${loopId}`);

    // Return loop info
    return {
      id: loopId,
      worktree_id: loopId,
      branch_name: branchName,
      status: "running",
      created_at: now,
      updated_at: now,
      prompt: request.prompt,
      completion_promise: request.completion_promise,
      iteration: 0,
      total_subtasks: 0,
      completed_subtasks: 0,
      current_subtask: request.prompt,
      slam_phase: "planning",
      tokens: {
        totalInput: 0,
        totalOutput: 0,
        byIteration: [],
      },
      files_changed: [],
      machine: machineInfo,
    };
  }

  /**
   * Stop a Ralph loop (kills process, optionally cleans up branch)
   */
  async stopRalphLoop(loopId: string, cleanupBranch: boolean = false): Promise<void> {
    let stopped = false;

    // Stop active process if found
    const processInfo = this.activeProcesses.get(loopId);
    if (processInfo) {
      console.log(`[RalphService] Stopping loop ${loopId}...`);

      // Kill process
      processInfo.process.kill("SIGTERM");
      this.activeProcesses.delete(loopId);

      // Release lock if this was the active loop
      if (this.activeLoopLock === loopId) {
        this.activeLoopLock = null;
      }

      stopped = true;
    }

    // Also check by PID
    const pid = this.pids.get(loopId);
    if (pid && await this.isProcessRunning(pid)) {
      console.log(`[RalphService] Killing process ${pid} for loop ${loopId}`);
      process.kill(pid, "SIGTERM");
      this.pids.delete(loopId);

      // Release lock if this was the active loop
      if (this.activeLoopLock === loopId) {
        this.activeLoopLock = null;
      }

      stopped = true;
    }

    // Clean up branch if requested
    if (cleanupBranch) {
      try {
        await this.gitService.deleteBranch(loopId);
        console.log(`[RalphService] Cleaned up branch for loop ${loopId}`);
      } catch (error) {
        console.error(`[RalphService] Failed to cleanup branch:`, error);
      }
    }

    return;
  }

  /**
   * Get a specific Ralph loop
   */
  async getRalphLoop(loopId: string): Promise<RalphLoop | null> {
    const loops = await this.listRalphLoops();
    return loops.find(l => l.id === loopId) || null;
  }

  /**
   * Get logs for a Ralph loop
   */
  async getRalphLoopLogs(loopId: string): Promise<string> {
    const logFile = path.join(LOGS_DIR, `${loopId}.log`);
    try {
      return await fsp.readFile(logFile, "utf-8");
    } catch {
      return "";
    }
  }

  /**
   * Get commits from current branch
   */
  async getRalphLoopCommits(loopId: string): Promise<RalphLoopCommit[]> {
    const commits = await this.gitService.getRecentCommits(10);

    return commits.map(c => ({
      hash: c.hash,
      message: c.message,
      timestamp: c.timestamp,
    }));
  }

  /**
   * Find Ralph Iterative state files in scan directories
   */
  private async findRalphIterativeStateFiles(): Promise<Array<{ filePath: string; projectName: string }>> {
    const files: Array<{ filePath: string; projectName: string }> = [];

    for (const scanDir of RALPH_SCAN_DIRS) {
      try {
        await fsp.access(scanDir);

        // Recursively find .ralph-iterative.*.json files
        const entries = await this.findFilesRecursive(scanDir, ".ralph-iterative.*.json");

        for (const filePath of entries) {
          // Extract project name from path
          const parts = filePath.split(path.sep);
          const projectName = parts[parts.length - 2]; // Parent directory name

          files.push({ filePath, projectName });
        }
      } catch {
        // Ignore access errors
      }
    }

    return files;
  }

  /**
   * Recursively find files matching pattern
   */
  private async findFilesRecursive(dir: string, pattern: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and .git
          if (entry.name === "node_modules" || entry.name === ".git") {
            continue;
          }
          files.push(...await this.findFilesRecursive(fullPath, pattern));
        } else if (entry.isFile() && entry.name.match(pattern)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore readdir errors
    }

    return files;
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
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect machine resources
   */
  private async detectMachineResources(): Promise<any> {
    try {
      const os = await import("os");
      const { cpus } = os;

      return {
        cpu: {
          count: cpus().length,
          model: cpus()[0]?.model || "unknown",
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
        },
        platform: {
          os: os.platform(),
          arch: os.arch(),
        },
      };
    } catch (error) {
      console.error("Failed to detect machine resources:", error);
      return {
        cpu: { count: 1, model: "unknown" },
        memory: { total: 0, free: 0 },
        platform: { os: "unknown", arch: "unknown" },
      };
    }
  }

  /**
   * Cleanup old branches (TTL-based)
   */
  async cleanupOldBranches(maxAgeHours: number = 24): Promise<{ deleted: string[]; errors: Record<string, string> }> {
    return await this.gitService.cleanupOldBranches(maxAgeHours);
  }

  /**
   * Get active process for streaming (WebSocket support)
   */
  getActiveProcess(loopId: string) {
    return this.activeProcesses.get(loopId);
  }
}
