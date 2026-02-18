// Git Branch Management Service (formerly Worktrees)

import { promises as fsp } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import type { Worktree, CreateWorktreeRequest } from "@ebowwa/codespaces-types/compile";
import { GitHubPrService } from "./github-pr.js";

const execAsync = promisify(exec);

// Configuration
const REPOS_BASE_PATH = process.env.REPOS_BASE_PATH || path.join(process.env.HOME || "", "repos");
const DEFAULT_REPOSITORY = "main-repo";

export class GitService {
  private reposBasePath: string;
  private githubPrService: GitHubPrService;

  constructor() {
    this.reposBasePath = REPOS_BASE_PATH;
    this.githubPrService = new GitHubPrService();
  }

  /**
   * Get repository path for a given repository name
   */
  private getRepoPath(repository: string = DEFAULT_REPOSITORY): string {
    return path.join(this.reposBasePath, repository);
  }

  /**
   * List all Ralph branches (branches with "ralph" in the name)
   */
  async listBranches(repository: string = DEFAULT_REPOSITORY): Promise<Worktree[]> {
    const repoPath = this.getRepoPath(repository);

    try {
      await fsp.access(repoPath);
    } catch {
      return [];
    }

    try {
      const { stdout } = await execAsync(
        `git branch --format="%(refname:short)|%(objectname)|%(committerdate:iso8601)"`,
        { cwd: repoPath }
      );

      const branches: Worktree[] = [];

      for (const line of stdout.trim().split("\n")) {
        if (!line) continue;

        const [branchName, commit, created_at] = line.split("|");

        // Only include Ralph branches (feature/ralph-* or similar)
        if (!branchName.includes("ralph") && !branchName.startsWith("feature/ralph")) {
          continue;
        }

        // Extract ID from branch name
        const id = branchName.replace(/^feature\//, "");

        // Get git stats
        const stats = await fsp.stat(repoPath).catch(() => null);

        branches.push({
          id,
          branch: branchName,
          commit,
          path: repoPath, // All branches share the same path
          created_at: created_at || stats?.mtime?.toISOString() || new Date().toISOString(),
          status: "ready",
        });
      }

      return branches;
    } catch (error) {
      console.error("Failed to list branches:", error);
      throw new Error("GIT_BRANCH_LIST_FAILED");
    }
  }

  /**
   * Create a new Ralph branch and switch to it
   */
  async createBranch(request: CreateWorktreeRequest, repository: string = DEFAULT_REPOSITORY): Promise<Worktree> {
    const repoPath = this.getRepoPath(repository);
    const branchName = `feature/ralph-${request.id}`;
    const baseBranch = request.branch || "main";

    // Ensure base repo exists
    try {
      await fsp.access(repoPath);
    } catch {
      if (request.repository_url) {
        await execAsync(`git clone "${request.repository_url}" "${repoPath}"`);
      } else {
        throw new Error("REPOSITORY_NOT_FOUND");
      }
    }

    try {
      // Fetch latest changes
      await execAsync(`git fetch origin`, { cwd: repoPath });
      await execAsync(`git checkout origin/${baseBranch} -B ${branchName}`, { cwd: repoPath });

      // Pull if base branch exists locally
      try {
        await execAsync(`git pull origin ${baseBranch}`, { cwd: repoPath });
      } catch {
        // Ignore pull errors (branch might not exist on remote)
      }

      // Create .claude directory
      await fsp.mkdir(path.join(repoPath, ".claude"), { recursive: true });

      return {
        id: request.id,
        branch: branchName,
        commit: request.commit || "HEAD",
        path: repoPath,
        created_at: new Date().toISOString(),
        status: "ready",
      };
    } catch (error) {
      console.error("Failed to create branch:", error);
      throw new Error("GIT_BRANCH_CREATE_FAILED");
    }
  }

  /**
   * Delete a Ralph branch and switch back to main
   */
  async deleteBranch(branchId: string, repository: string = DEFAULT_REPOSITORY): Promise<void> {
    const repoPath = this.getRepoPath(repository);
    const branchName = `feature/ralph-${branchId}`;

    try {
      // First, check if we're currently on the branch to delete
      const { stdout: currentBranch } = await execAsync(`git rev-parse --abbrev-ref HEAD`, { cwd: repoPath });

      if (currentBranch.trim() === branchName) {
        // Switch to main first
        await execAsync(`git checkout main`, { cwd: repoPath }).catch(() => {
          // If main doesn't exist, try dev
          return execAsync(`git checkout dev`, { cwd: repoPath });
        });
      }

      // Delete the branch (force delete to handle unmerged branches)
      await execAsync(`git branch -D ${branchName}`, { cwd: repoPath });
    } catch (error) {
      console.error("Failed to delete branch:", error);
      throw new Error("GIT_BRANCH_DELETE_FAILED");
    }
  }

  /**
   * Commit changes in current branch
   */
  async commitChanges(branchId: string, message: string, repository: string = DEFAULT_REPOSITORY): Promise<string> {
    const repoPath = this.getRepoPath(repository);

    try {
      // Stage all changes
      await execAsync(`git add -A`, { cwd: repoPath });

      // Check if there are changes to commit
      const { stdout: status } = await execAsync(`git status --porcelain`, { cwd: repoPath });
      if (!status.trim()) {
        return "No changes to commit";
      }

      // Commit
      await execAsync(`git commit -m "${message}"`, { cwd: repoPath });

      // Get commit hash
      const { stdout: hash } = await execAsync(`git rev-parse HEAD`, { cwd: repoPath });

      return hash.trim();
    } catch (error) {
      console.error("Failed to commit changes:", error);
      throw new Error("GIT_COMMIT_FAILED");
    }
  }

  /**
   * Push branch to remote (for PR creation)
   */
  async pushBranch(branchId: string, repository: string = DEFAULT_REPOSITORY): Promise<void> {
    const repoPath = this.getRepoPath(repository);
    const branchName = `feature/ralph-${branchId}`;

    try {
      await execAsync(`git push -u origin ${branchName}`, { cwd: repoPath });
    } catch (error) {
      console.error("Failed to push branch:", error);
      throw new Error("GIT_PUSH_FAILED");
    }
  }

  /**
   * Get recent commits from current branch
   */
  async getRecentCommits(count: number = 5, repository: string = DEFAULT_REPOSITORY): Promise<Array<{ hash: string; message: string; timestamp: string }>> {
    const repoPath = this.getRepoPath(repository);

    try {
      const { stdout } = await execAsync(`git log --pretty=format:"%H|%s|%ct" -${count}`, { cwd: repoPath });
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

  /**
   * Get current branch name
   */
  async getCurrentBranch(repository: string = DEFAULT_REPOSITORY): Promise<string> {
    const repoPath = this.getRepoPath(repository);

    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref HEAD`, { cwd: repoPath });
      return stdout.trim();
    } catch (error) {
      console.error("Failed to get current branch:", error);
      throw new Error("GIT_GET_CURRENT_BRANCH_FAILED");
    }
  }

  /**
   * Check if branch has uncommitted changes
   */
  async hasUncommittedChanges(repository: string = DEFAULT_REPOSITORY): Promise<boolean> {
    const repoPath = this.getRepoPath(repository);

    try {
      const { stdout } = await execAsync(`git status --porcelain`, { cwd: repoPath });
      return stdout.trim().length > 0;
    } catch (error) {
      console.error("Failed to check for uncommitted changes:", error);
      return false;
    }
  }

  /**
   * Clean up old Ralph branches (TTL-based)
   */
  async cleanupOldBranches(maxAgeHours: number = 24, repository: string = DEFAULT_REPOSITORY): Promise<{ deleted: string[]; errors: Record<string, string> }> {
    const repoPath = this.getRepoPath(repository);
    const branches = await this.listBranches(repository);
    const deleted: string[] = [];
    const errors: Record<string, string> = {};
    const now = Date.now();

    try {
      // Switch to main to avoid deleting current branch
      await execAsync(`git checkout main`, { cwd: repoPath }).catch(() => {
        return execAsync(`git checkout dev`, { cwd: repoPath });
      });
    } catch {
      // Ignore checkout errors
    }

    for (const branch of branches) {
      const ageMs = now - new Date(branch.created_at).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);

      if (ageHours > maxAgeHours) {
        try {
          await this.deleteBranch(branch.id, repository);
          deleted.push(branch.branch);
        } catch (error) {
          errors[branch.branch] = (error as Error).message;
        }
      }
    }

    return { deleted, errors };
  }

  /**
   * Create a Pull Request from Ralph branch to dev
   */
  async createPrToDev(params: {
    branchId: string;
    title?: string;
    body?: string;
  }): Promise<{ url: string; number: number } | null> {
    const branchName = `feature/ralph-${params.branchId}`;
    const repoPath = this.getRepoPath();

    try {
      // Push branch first
      await this.pushBranch(params.branchId);

      // Check if PR already exists
      const exists = await this.githubPrService.prExists(params.branchId);
      if (exists) {
        console.log(`[GitService] PR already exists for branch ${branchName}`);
        return null;
      }

      // Create PR
      const result = await this.githubPrService.createPrToDev({
        branchId: params.branchId,
        title: params.title,
        body: params.body
      });

      console.log(`[GitService] Created PR: ${result.url}`);
      return result;
    } catch (error) {
      console.error("[GitService] Failed to create PR:", error);
      throw new Error("GIT_PR_CREATE_FAILED");
    }
  }
}
