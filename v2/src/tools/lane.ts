/**
 * Lane CLI Tool Installer
 * Clones and installs lane (uses default branch)
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class LaneTool extends BaseTool {
  name = "lane";
  description = "Lane CLI - Git worktree alternative for parallel development";

  // Lane repository configuration
  readonly REPO_URL = "https://github.com/ebowwa/lane.git";
  readonly CLONE_DIR = "~/lane";

  async isApplicable(env: Environment): Promise<boolean> {
    // Lane is useful for all environments where git work is done
    // Skip in CI/CD where worktrees aren't needed
    return env.type !== "ci";
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    return await this.commandExists("lane");
  }

  async install(env: Environment): Promise<void> {
    const ctx = this.getContext(env);
    const cloneDir = ctx.homeDir + "/lane";

    console.log(`  Installing ${this.name} from ${this.REPO_URL}...`);

    // Check if lane directory already exists
    try {
      const { execSync } = await import("child_process");
      const exists = execSync(`test -d ${cloneDir} && echo "exists" || echo "not"`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (exists === "exists") {
        console.log(`  ✓ ${this.name} already cloned at ${cloneDir}`);
        console.log(`  → Updating to latest...`);

        // Fetch and pull current branch
        await this.exec(
          ["git", "-C", cloneDir, "fetch", "origin"],
          { cwd: cloneDir }
        );
        await this.exec(
          ["git", "-C", cloneDir, "pull"],
          { cwd: cloneDir }
        );
      } else {
        // Clone the repository (uses default branch)
        console.log(`  → Cloning to ${cloneDir}...`);
        await this.exec(
          ["git", "clone", this.REPO_URL, cloneDir],
          { cwd: ctx.homeDir }
        );
      }
    } catch (error) {
      throw new Error(`Failed to clone lane: ${error}`);
    }

    // Install dependencies
    console.log(`  → Installing dependencies...`);
    const installProc = Bun.spawn(
      ["bun", "install"],
      {
        cwd: cloneDir,
        stdout: "inherit",
        stderr: "inherit",
      }
    );

    const installExitCode = await installProc.exited;
    if (installExitCode !== 0) {
      throw new Error(`Failed to install lane dependencies`);
    }

    // Build lane
    console.log(`  → Building ${this.name}...`);
    const buildProc = Bun.spawn(
      ["bun", "run", "build"],
      {
        cwd: cloneDir,
        stdout: "inherit",
        stderr: "inherit",
      }
    );

    const buildExitCode = await buildProc.exited;
    if (buildExitCode !== 0) {
      throw new Error(`Failed to build lane`);
    }

    // Install globally by symlinking to bin directory
    // Note: bun install -g . has dependency loop bug with some packages
    // Using direct symlink instead
    console.log(`  → Installing ${this.name} globally...`);
    await this.ensureDir(ctx.binDir);
    const binPath = `${ctx.binDir}/lane`;

    try {
      // Remove existing symlink or file
      await this.exec(["rm", "-f", binPath]);
    } catch {}

    // Create symlink to the built binary
    await this.exec(["ln", "-s", `${cloneDir}/lane`, binPath]);

    console.log(`  ✓ ${this.name} linked to ${binPath}`);

    // Set up shell completion
    console.log(`  → Setting up shell integration...`);
    try {
      await this.exec(
        ["lane", "init-shell"],
        { cwd: ctx.homeDir, env: { ...process.env, HOME: ctx.homeDir } }
      );
    } catch {
      // init-shell might fail if shell config is weird, non-fatal
      console.log(`  ⚠ Shell integration skipped (you can run 'lane init-shell' manually)`);
    }

    console.log(`  ✓ ${this.name} installed`);
  }
}
