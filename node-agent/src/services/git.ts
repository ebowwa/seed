// Git Worktree Management Service

import { promises as fsp } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import type { Worktree, CreateWorktreeRequest } from "@ebowwa/codespaces-types/compile";

const execAsync = promisify(exec);

// Configuration
const REPOS_BASE_PATH = process.env.REPOS_BASE_PATH || path.join(process.env.HOME || "", "repos");
const DEFAULT_REPOSITORY = "main-repo";

export class GitService {
  private reposBasePath: string;

  constructor() {
    this.reposBasePath = REPOS_BASE_PATH;
  }

  /**
   * List all git worktrees for a repository
   */
  async listWorktrees(repository: string = DEFAULT_REPOSITORY): Promise<Worktree[]> {
    const repoPath = path.join(this.reposBasePath, repository);

    try {
      // Check if repo exists
      await fsp.access(repoPath);
    } catch {
      // Repo doesn't exist, return empty
      return [];
    }

    try {
      const { stdout } = await execAsync(`git worktree list`, { cwd: repoPath });
      const worktrees: Worktree[] = [];

      for (const line of stdout.trim().split("\n")) {
        if (!line) continue;

        // Parse regular git worktree list output format:
        // /path/to/worktree  abc1234 [branch-name]
        const parts = line.trim().split(/\s+/);
        const worktreePath = parts[0];
        const commit = parts[1];
        const branch = parts[2]?.replace(/^\[|\]$/g, "") || "detached";

        // Extract worktree ID from path
        const id = worktreePath.split("/").pop() || path.basename(worktreePath);

        // Get stats
        const stats = await fsp.stat(worktreePath).catch(() => null);

        worktrees.push({
          id,
          branch,
          commit,
          path: worktreePath,
          created_at: stats?.mtime.toISOString() || new Date().toISOString(),
          status: "ready",
        });
      }

      return worktrees;
    } catch (error) {
      console.error("Failed to list worktrees:", error);
      throw new Error("GIT_WORKTREE_LIST_FAILED");
    }
  }

  /**
   * Create a new git worktree
   */
  async createWorktree(request: CreateWorktreeRequest, repository: string = DEFAULT_REPOSITORY): Promise<Worktree> {
    const repoPath = path.join(this.reposBasePath, repository);
    const worktreePath = path.join(this.reposBasePath, `${repository}-worktree-${request.id}`);

    // Ensure base repo exists
    try {
      await fsp.access(repoPath);
    } catch {
      // Clone the repository if it doesn't exist
      if (request.repository_url) {
        await execAsync(`git clone "${request.repository_url}" "${repoPath}"`);
      } else {
        throw new Error("REPOSITORY_NOT_FOUND");
      }
    }

    // Create the worktree
    const branch = request.commit ? `${request.branch}^^{}` : request.branch; // Detached if commit specified
    const command = `git worktree add "${worktreePath}" ${branch}`;

    try {
      await execAsync(command, { cwd: repoPath });

      // Create .claude directory in worktree
      await fsp.mkdir(path.join(worktreePath, ".claude"), { recursive: true });

      return {
        id: request.id,
        branch: request.branch,
        commit: request.commit,
        path: worktreePath,
        created_at: new Date().toISOString(),
        status: "ready",
      };
    } catch (error) {
      console.error("Failed to create worktree:", error);
      throw new Error("GIT_WORKTREE_CREATE_FAILED");
    }
  }

  /**
   * Remove a git worktree
   */
  async removeWorktree(worktreeId: string, repository: string = DEFAULT_REPOSITORY): Promise<void> {
    const repoPath = path.join(this.reposBasePath, repository);
    const worktreePath = path.join(this.reposBasePath, `${repository}-worktree-${worktreeId}`);

    try {
      // First, stop any Ralph loop in this worktree
      // (This will be handled by the Ralph service)

      // Remove the worktree
      await execAsync(`git worktree remove "${worktreePath}"`, { cwd: repoPath });
    } catch (error) {
      console.error("Failed to remove worktree:", error);
      throw new Error("GIT_WORKTREE_REMOVE_FAILED");
    }
  }

  /**
   * Get recent commits from a worktree
   */
  async getRecentCommits(worktreePath: string, count: number = 5): Promise<Array<{ hash: string; message: string; timestamp: string }>> {
    try {
      const { stdout } = await execAsync(`git log --pretty=format:"%H|%s|%ct" -${count}`, { cwd: worktreePath });
      const commits: Array<{ hash: string; message: string; timestamp: string }> = [];

      for (const line of stdout.trim().split("\n")) {
        if (!line) continue;
        const [hash, message, timestamp] = line.split("|");
        commits.push({
          hash,
          message,
          timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
        });
      }

      return commits;
    } catch (error) {
      console.error("Failed to get commits:", error);
      return [];
    }
  }
}
