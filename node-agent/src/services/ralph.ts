// Ralph Loop Management Service (Checkpoint-based branches)
//
// CHECKPOINT MODEL: Loops create multiple checkpoint branches during execution.
// Each checkpoint is a save point that can be rolled back to.
// Final checkpoint can be merged to main codebase via PR.
//
// Branch naming: ralph/{loopId}/cp-{number}
// Example: ralph/abc123/cp-1, ralph/abc123/cp-2, etc.
//
// State file: .ralph-iterative.{loopId}.json
// Contains checkpoints array tracking all branch snapshots.

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
  RalphCheckpoint,
  CreateCheckpointRequest,
} from "@ebowwa/codespaces-types/compile";
import { GitService } from "./git.js";
import { ConsoleLoggerService } from "./console-logger.js";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);

// Configuration
const NODE_AGENT_DIR = path.join(process.env.HOME || "", ".node-agent");
const PIDS_DIR = path.join(NODE_AGENT_DIR, "pids");
const LOGS_DIR = path.join(NODE_AGENT_DIR, "logs");
const REPOS_BASE_PATH = path.join(process.env.HOME || "", "repos");
const DEFAULT_REPO = "main-repo";

// Directories to scan for Ralph Iterative state files
const RALPH_SCAN_DIRS = [
  path.join(process.env.HOME || "", "seed"), // Main seed directory
  REPOS_BASE_PATH, // All repos
];

/**
 * State file structure with checkpoint support
 */
interface RalphLoopStateFileWithCheckpoints extends RalphIterativeStateFile {
  loopId: string;
  projectPath: string; // Working directory for this loop
  checkpoints: RalphCheckpoint[];
  currentCheckpoint: string | null;
  targetBaseBranch: string;
}

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
   * Get count of active loops
   */
  getActiveLoopCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * Get all active loop IDs
   */
  getActiveLoopIds(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * List all Ralph loops (by checking state files and tracking processes)
   */
  async listRalphLoops(): Promise<RalphLoop[]> {
    const loops: RalphLoop[] = [];
    const runningProcessIds = Array.from(this.activeProcesses.keys());
    const iterativeFiles = await this.findRalphIterativeStateFiles();

    for (const { filePath, projectName } of iterativeFiles) {
      try {
        const content = await fsp.readFile(filePath, "utf-8");
        const state: RalphLoopStateFileWithCheckpoints = JSON.parse(content);

        let status: "starting" | "running" | "complete" | "error" | "stopped" = "stopped";
        const loopId = state.loopId || `${projectName}-${state.iteration}`;
        const isProcessRunning = this.activeProcesses.has(loopId) ||
                                 (this.pids.get(loopId) && await this.isProcessRunning(this.pids.get(loopId)!));

        if (state.slam?.phase === "complete") {
          status = "complete";
        } else if (state.slam?.phase === "planning") {
          status = isProcessRunning ? "starting" : "stopped";
        } else if (isProcessRunning) {
          status = "running";
        }

        if (status === "complete" && !isProcessRunning) {
          continue;
        }

        if (status === "stopped") {
          continue;
        }

        const subtasks = state.slam?.subtasks || [];
        const totalSubtasks = subtasks.length;
        const completedSubtasks = state.slam?.completedSubtasks?.length || 0;
        const currentSubtask = subtasks.find(s => !state.slam?.completedSubtasks?.includes(s.id));

        loops.push({
          id: loopId,
          worktree_id: projectName,
          branch_name: state.currentCheckpoint || "none",
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
          checkpoints: state.checkpoints || [],
          current_checkpoint: state.currentCheckpoint,
          target_base_branch: state.targetBaseBranch || "dev",
          project_path: state.projectPath,
        });
      } catch (error) {
        console.error(`Failed to parse state file ${filePath}:`, error);
      }
    }

    loops.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return loops;
  }

  /**
   * Start a new Ralph loop (NO branch created at start)
   *
   * The loop runs on the current branch until createCheckpoint() is called.
   * Checkpoints are created during iteration to preserve state.
   */
  async startRalphLoop(request: CreateRalphLoopRequest): Promise<RalphLoop> {
    const loopId = request.worktree_id || `ralph-${Date.now()}`;
    const baseBranch = request.base_branch || "dev";

    // Determine project path
    let projectPath: string;
    if (request.project_path) {
      // If absolute path, use as-is; otherwise treat as relative to ~/repos
      if (path.isAbsolute(request.project_path)) {
        projectPath = request.project_path;
      } else {
        projectPath = path.join(REPOS_BASE_PATH, request.project_path);
      }
    } else {
      // Default to main-repo
      projectPath = path.join(REPOS_BASE_PATH, DEFAULT_REPO);
    }

    // Setup state file paths
    const pidFile = path.join(PIDS_DIR, `${loopId}.pid`);
    const logFile = path.join(LOGS_DIR, `${loopId}.log`);
    // Use standard ralph-iterative state file name so hooks can find it
    const stateFilePath = path.join(projectPath, ".claude", ".ralph-iterative.local.json");

    // Check if already running
    if (await this.fileExists(pidFile)) {
      const pid = parseInt(await fsp.readFile(pidFile, "utf-8"), 10);
      if (await this.isProcessRunning(pid)) {
        throw new Error("RALPH_LOOP_ALREADY_RUNNING");
      }
    }

    // Check if state file already exists
    if (await this.fileExists(stateFilePath)) {
      throw new Error("RALPH_ITERATIVE_ALREADY_ACTIVE");
    }

    // Ensure repo exists
    await this.ensureRepoExists(request.repository_url, projectPath);

    // Detect machine resources
    const machineInfo = await this.detectMachineResources();

    // Create state file with checkpoint support
    const now = new Date().toISOString();
    const stateContent: RalphLoopStateFileWithCheckpoints = {
      loopId,
      projectPath, // Store project path in state
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
      // Checkpoint tracking
      checkpoints: [],
      currentCheckpoint: null,
      targetBaseBranch: baseBranch,
      // Git config
      git: {
        enabled: request.auto_commit || request.auto_pr || false,
        autoCommit: request.auto_commit || request.auto_pr || false,
        autoPR: request.auto_pr || false,
        baseBranch: baseBranch,
        branchName: null, // No initial branch
        branchCreated: false,
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
    const claudeDir = path.join(projectPath, ".claude");
    await fsp.mkdir(claudeDir, { recursive: true });

    // Write state file
    await fsp.writeFile(stateFilePath, JSON.stringify(stateContent, null, 2));

    // Create settings.local.json
    const settingsFile = path.join(projectPath, ".claude", "settings.local.json");
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

    // Spawn Claude Code process
    const child = await this.spawnClaudeProcess(loopId, projectPath, request.prompt);

    if (!child.pid || !child.stdin || !child.stdout) {
      throw new Error("PROCESS_START_FAILED");
    }

    // Store process
    this.activeProcesses.set(loopId, {
      process: child,
      stdout: child.stdout,
      stdin: child.stdin,
    });

    child.on("exit", (code) => {
      console.log(`[RalphService] Loop ${loopId} exited with code ${code}`);
      this.consoleLogger.logProcessStop(child.pid);
      this.pids.delete(loopId);
      this.activeProcesses.delete(loopId);
    });

    child.on("error", (err) => {
      console.error(`[RalphService] Loop ${loopId} error:`, err);
    });

    await fsp.writeFile(pidFile, child.pid.toString());
    this.consoleLogger.logProcessStart(child.pid, `ralph-loop-${loopId}`);

    return {
      id: loopId,
      worktree_id: loopId,
      branch_name: "none",
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
      tokens: { totalInput: 0, totalOutput: 0, byIteration: [] },
      files_changed: [],
      machine: machineInfo,
      checkpoints: [],
      current_checkpoint: null,
      target_base_branch: baseBranch,
      project_path: projectPath,
    };
  }

  /**
   * Create a checkpoint (branch snapshot) for a running loop
   *
   * This creates a branch: ralph/{loopId}/cp-{checkpointNumber}
   * The checkpoint preserves current code state and can be rolled back to.
   */
  async createCheckpoint(request: CreateCheckpointRequest): Promise<RalphCheckpoint> {
    const { loopId, summary, setActive = true } = request;
    const { stateFilePath, projectPath, state } = await this.getLoopState(loopId);

    if (!state) {
      throw new Error("RALPH_LOOP_NOT_FOUND");
    }

    // Calculate checkpoint number
    const checkpointNumber = state.checkpoints.length + 1;
    const branchName = `ralph/${loopId}/cp-${checkpointNumber}`;

    // Get current commit
    const { stdout: commitHash } = await execAsync(`git rev-parse HEAD`, { cwd: projectPath });
    const commit = commitHash.trim();

    // Create checkpoint branch from current state
    await execAsync(`git checkout -b ${branchName}`, { cwd: projectPath });

    // Create checkpoint object
    const checkpoint: RalphCheckpoint = {
      branch: branchName,
      iteration: state.iteration,
      commit,
      summary,
      timestamp: new Date().toISOString(),
      isActive: setActive,
    };

    // Mark previous checkpoints as inactive if this is active
    if (setActive) {
      state.checkpoints.forEach(cp => cp.isActive = false);
    }

    // Add to state
    state.checkpoints.push(checkpoint);
    if (setActive) {
      state.currentCheckpoint = branchName;
    }
    state.lastUpdate = new Date().toISOString();

    // Save state
    await fsp.writeFile(stateFilePath, JSON.stringify(state, null, 2));

    console.log(`[RalphService] Created checkpoint ${branchName} for loop ${loopId}`);

    return checkpoint;
  }

  /**
   * Rollback to a previous checkpoint
   *
   * This resets the working directory to the checkpoint's state.
   * Creates a new branch from the checkpoint for continued work.
   */
  async rollbackToCheckpoint(loopId: string, checkpointBranch: string): Promise<RalphCheckpoint> {
    const { stateFilePath, projectPath, state } = await this.getLoopState(loopId);

    if (!state) {
      throw new Error("RALPH_LOOP_NOT_FOUND");
    }

    // Find the checkpoint
    const checkpoint = state.checkpoints.find(cp => cp.branch === checkpointBranch);
    if (!checkpoint) {
      throw new Error(`CHECKPOINT_NOT_FOUND: ${checkpointBranch}`);
    }

    // Checkout the checkpoint branch
    await execAsync(`git checkout ${checkpointBranch}`, { cwd: projectPath });

    // Mark as active
    state.checkpoints.forEach(cp => cp.isActive = cp.branch === checkpointBranch);
    state.currentCheckpoint = checkpointBranch;
    state.lastUpdate = new Date().toISOString();

    // Save state
    await fsp.writeFile(stateFilePath, JSON.stringify(state, null, 2));

    console.log(`[RalphService] Rolled back to checkpoint ${checkpointBranch} for loop ${loopId}`);

    return checkpoint;
  }

  /**
   * List all checkpoints for a loop
   */
  async listCheckpoints(loopId: string): Promise<RalphCheckpoint[]> {
    const { state } = await this.getLoopState(loopId);
    return state?.checkpoints || [];
  }

  /**
   * Create PR from best checkpoint to target branch
   */
  async createPrFromCheckpoint(
    loopId: string,
    checkpointBranch: string,
    title?: string,
    body?: string
  ): Promise<{ url: string; number: number } | null> {
    const { projectPath, state } = await this.getLoopState(loopId);

    if (!state) {
      throw new Error("RALPH_LOOP_NOT_FOUND");
    }

    // Find checkpoint
    const checkpoint = state.checkpoints.find(cp => cp.branch === checkpointBranch);
    if (!checkpoint) {
      throw new Error(`CHECKPOINT_NOT_FOUND: ${checkpointBranch}`);
    }

    // Push checkpoint branch
    await execAsync(`git push -u origin ${checkpointBranch}`, { cwd: projectPath });

    // Create PR using gh CLI
    const prTitle = title || `Ralph: ${checkpoint.summary}`;
    const prBody = body || `Checkpoint from Ralph loop ${loopId}\n\nIteration: ${checkpoint.iteration}\nSummary: ${checkpoint.summary}`;

    const { stdout } = await execAsync(
      `gh pr create --base ${state.targetBaseBranch} --head ${checkpointBranch} --title "${prTitle}" --body "${prBody}"`,
      { cwd: projectPath }
    );

    // Parse PR URL and number
    const match = stdout.match(/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    if (match) {
      return {
        url: stdout.trim(),
        number: parseInt(match[2], 10),
      };
    }

    return null;
  }

  /**
   * Stop a Ralph loop
   */
  async stopRalphLoop(loopId: string, cleanupCheckpoints: boolean = false): Promise<void> {
    // Stop active process
    const processInfo = this.activeProcesses.get(loopId);
    if (processInfo) {
      console.log(`[RalphService] Stopping loop ${loopId}...`);
      processInfo.process.kill("SIGTERM");
      this.activeProcesses.delete(loopId);
    }

    // Check by PID
    const pid = this.pids.get(loopId);
    if (pid && await this.isProcessRunning(pid)) {
      console.log(`[RalphService] Killing process ${pid} for loop ${loopId}`);
      process.kill(pid, "SIGTERM");
      this.pids.delete(loopId);
    }

    // Optionally cleanup checkpoint branches
    if (cleanupCheckpoints) {
      const { projectPath, state } = await this.getLoopState(loopId);
      if (state) {
        for (const cp of state.checkpoints) {
          try {
            await execAsync(`git branch -D ${cp.branch}`, { cwd: projectPath });
            console.log(`[RalphService] Deleted checkpoint branch ${cp.branch}`);
          } catch {
            // Ignore if branch doesn't exist
          }
        }
      }
    }
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
   * Get commits from current checkpoint
   */
  async getRalphLoopCommits(loopId: string): Promise<RalphLoopCommit[]> {
    const commits = await this.gitService.getRecentCommits(10);
    return commits.map(c => ({
      hash: c.hash,
      message: c.message,
      timestamp: c.timestamp,
    }));
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Get loop state file path and content
   * Searches for the state file in all known directories
   * Checks both standard local.json and loop-specific files
   */
  private async getLoopState(loopId: string): Promise<{
    stateFilePath: string;
    projectPath: string;
    state: RalphLoopStateFileWithCheckpoints | null;
  }> {
    // Search for state file in all scan directories
    for (const scanDir of RALPH_SCAN_DIRS) {
      // Try standard local.json first (what ralph-iterative hooks expect)
      const localPath = path.join(scanDir, ".claude", ".ralph-iterative.local.json");
      try {
        const content = await fsp.readFile(localPath, "utf-8");
        const state: RalphLoopStateFileWithCheckpoints = JSON.parse(content);
        // Check if this state file belongs to our loop (by loopId in content)
        if (state.loopId === loopId) {
          return {
            stateFilePath: localPath,
            projectPath: state.projectPath || path.join(REPOS_BASE_PATH, DEFAULT_REPO),
            state,
          };
        }
      } catch {
        // Continue to next option
      }

      // Try loop-specific file as fallback
      const loopPath = path.join(scanDir, ".claude", `.ralph-iterative.${loopId}.json`);
      try {
        const content = await fsp.readFile(loopPath, "utf-8");
        const state: RalphLoopStateFileWithCheckpoints = JSON.parse(content);
        return {
          stateFilePath: loopPath,
          projectPath: state.projectPath || path.join(REPOS_BASE_PATH, DEFAULT_REPO),
          state,
        };
      } catch {
        // Continue to next directory
      }
    }

    // Not found - return defaults
    return {
      stateFilePath: "",
      projectPath: path.join(REPOS_BASE_PATH, DEFAULT_REPO),
      state: null,
    };
  }

  private async ensureRepoExists(repositoryUrl?: string, projectPath?: string): Promise<void> {
    const targetPath = projectPath || path.join(REPOS_BASE_PATH, DEFAULT_REPO);
    try {
      await fsp.access(targetPath);
    } catch {
      if (repositoryUrl) {
        await execAsync(`git clone "${repositoryUrl}" "${targetPath}"`);
      } else {
        throw new Error("REPOSITORY_NOT_FOUND");
      }
    }
  }

  private async spawnClaudeProcess(loopId: string, projectPath: string, prompt: string): Promise<ReturnType<typeof spawn>> {
    const supervisorPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "lib",
      "rolling-keys-supervisor.ts"
    );

    const bunPath = path.join(process.env.HOME || "", ".bun", "bin", "bun");

    // Spawn bun directly (not through doppler) to preserve stdin pipe
    // We already have doppler secrets in our env, pass them through
    const options = {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"] as const,
      env: {
        ...process.env,
        // Ensure rolling keys env is passed as JSON array
        // Supervisor expects format: '["key1","key2"]'
        ANTHROPIC_API_KEYS: process.env.ANTHROPIC_API_KEYS ||
          (process.env.ANTHROPIC_API_KEY ? JSON.stringify([process.env.ANTHROPIC_API_KEY]) : undefined),
      },
    };

    const child = spawn(bunPath, ["run", supervisorPath], options);

    // Send prompt via stdin after Claude initializes through supervisor
    // Supervisor needs ~5s to start, Claude needs ~5s more
    setTimeout(() => {
      if (child.stdin && !child.stdin.destroyed) {
        console.log(`[RalphService] Sending prompt to loop after delay...`);
        // Send raw prompt - Claude will process it directly
        // Note: Skill invocations via stdin don't work reliably, use direct prompt
        child.stdin.write(`${prompt}\n`);
      } else {
        console.error(`[RalphService] Cannot send prompt - stdin not available`);
      }
    }, 10000);

    return child;
  }

  private async findRalphIterativeStateFiles(): Promise<Array<{ filePath: string; projectName: string }>> {
    const files: Array<{ filePath: string; projectName: string }> = [];

    for (const scanDir of RALPH_SCAN_DIRS) {
      try {
        await fsp.access(scanDir);
        // Look for both standard local.json and any loop-specific files
        const entries = await this.findFilesRecursive(scanDir, "\\.ralph-iterative\\.(local|[a-zA-Z0-9-]+)\\.json");

        for (const filePath of entries) {
          const parts = filePath.split(path.sep);
          const projectName = parts[parts.length - 2];
          files.push({ filePath, projectName });
        }
      } catch {
        // Ignore access errors
      }
    }

    return files;
  }

  private async findFilesRecursive(dir: string, pattern: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git") {
            continue;
          }
          files.push(...await this.findFilesRecursive(fullPath, pattern));
        } else if (entry.isFile() && entry.name.match(pattern)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore readdir errors
    }

    return files;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

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
   * Cleanup old checkpoint branches (TTL-based)
   * Scans all repos in REPOS_BASE_PATH
   */
  async cleanupOldCheckpoints(maxAgeHours: number = 24): Promise<{ deleted: string[]; errors: Record<string, string> }> {
    const deleted: string[] = [];
    const errors: Record<string, string> = {};
    const now = Date.now();

    // Scan all repos in the repos directory
    try {
      const entries = await fsp.readdir(REPOS_BASE_PATH, { withFileTypes: true });
      const repoDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

      for (const repoName of repoDirs) {
        const repoPath = path.join(REPOS_BASE_PATH, repoName);

        // Get all ralph checkpoint branches in this repo
        const { stdout } = await execAsync(
          `git branch --format="%(refname:short)|%(committerdate:iso8601)" | grep "^ralph/"`,
          { cwd: repoPath }
        ).catch(() => ({ stdout: "" }));

        for (const line of stdout.trim().split("\n")) {
          if (!line) continue;

          const [branchName, createdAt] = line.split("|");
          const ageMs = now - new Date(createdAt).getTime();
          const ageHours = ageMs / (1000 * 60 * 60);

          if (ageHours > maxAgeHours) {
            try {
              // Switch away from branch if we're on it
              const { stdout: currentBranch } = await execAsync(`git rev-parse --abbrev-ref HEAD`, { cwd: repoPath });
              if (currentBranch.trim() === branchName) {
                await execAsync(`git checkout dev`, { cwd: repoPath }).catch(() => {});
              }

              await execAsync(`git branch -D ${branchName}`, { cwd: repoPath });
              deleted.push(`${repoName}:${branchName}`);
            } catch (error) {
              errors[`${repoName}:${branchName}`] = (error as Error).message;
            }
          }
        }
      }
    } catch (error) {
      console.error(`[RalphService] Error scanning repos:`, error);
    }

    return { deleted, errors };
  }

  /**
   * Get active process for streaming (WebSocket support)
   */
  getActiveProcess(loopId: string) {
    return this.activeProcesses.get(loopId);
  }
}
