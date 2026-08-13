/**
 * Ralph CLI Tool Installer
 * Clones Ralph repository and installs bash scripts to PATH
 *
 * Ralph provides iterative development loops via bash scripts that spawn Claude Code.
 * This is different from lane - Ralph is bash-based, not a compiled CLI tool.
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class RalphTool extends BaseTool {
  name = "ralph";
  description = "Ralph - Iterative development loops with Claude Code";

  // Ralph repository configuration
  readonly REPO_URL = "https://github.com/ebowwa/ralph.git";
  readonly BRANCH = "dev";
  readonly CLONE_DIR = "~/ralph";

  async isApplicable(env: Environment): Promise<boolean> {
    // Ralph is useful for development environments
    // Skip in CI/CD where interactive loops aren't needed
    return env.type !== "ci";
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    // Check if ralph script exists in PATH
    return await this.commandExists("ralph");
  }

  async install(env: Environment): Promise<void> {
    const ctx = this.getContext(env);
    const cloneDir = ctx.homeDir + "/ralph";
    const scriptsDir = `${cloneDir}/scripts`;

    console.log(`  Installing ${this.name} from ${this.REPO_URL} (${this.BRANCH} branch)...`);

    // Check if ralph directory already exists
    try {
      const { execSync } = await import("child_process");
      const exists = execSync(`test -d ${cloneDir} && echo "exists" || echo "not"`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (exists === "exists") {
        console.log(`  ✓ ${this.name} already cloned at ${cloneDir}`);
        console.log(`  → Updating to latest from ${this.BRANCH}...`);

        // Fetch and checkout the correct branch
        await this.exec(
          ["git", "-C", cloneDir, "fetch", "origin"],
          { cwd: cloneDir }
        );
        await this.exec(
          ["git", "-C", cloneDir, "checkout", this.BRANCH],
          { cwd: cloneDir }
        );
        await this.exec(
          ["git", "-C", cloneDir, "pull", "origin", this.BRANCH],
          { cwd: cloneDir }
        );
      } else {
        // Clone the repository
        console.log(`  → Cloning to ${cloneDir}...`);
        await this.exec(
          ["git", "clone", "-b", this.BRANCH, this.REPO_URL, cloneDir],
          { cwd: ctx.homeDir }
        );
      }
    } catch (error) {
      throw new Error(`Failed to clone ralph: ${error}`);
    }

    // Make scripts executable
    console.log(`  → Setting up scripts...`);
    const scripts = ["ralph.sh", "ralph-multi.sh", "ralph-team.sh", "autonomous-ralph.sh"];

    for (const script of scripts) {
      const scriptPath = `${scriptsDir}/${script}`;
      try {
        await this.chmod(scriptPath, "+x");
        console.log(`    ✓ ${script} is executable`);
      } catch {
        console.log(`    ⚠ ${script} not found, skipping`);
      }
    }

    // Create symlinks in binDir
    console.log(`  → Creating symlinks in ${ctx.binDir}...`);

    await this.ensureDir(ctx.binDir);

    // Symlink ralph.sh -> ralph
    try {
      await this.exec(
        ["ln", "-sf", `${scriptsDir}/ralph.sh`, `${ctx.binDir}/ralph`],
        { cwd: ctx.homeDir }
      );
      console.log(`    ✓ ralph → ${scriptsDir}/ralph.sh`);
    } catch (error) {
      console.log(`    ⚠ Failed to create ralph symlink: ${error}`);
    }

    // Symlink ralph-multi.sh -> ralph-multi
    try {
      await this.exec(
        ["ln", "-sf", `${scriptsDir}/ralph-multi.sh`, `${ctx.binDir}/ralph-multi`],
        { cwd: ctx.homeDir }
      );
      console.log(`    ✓ ralph-multi → ${scriptsDir}/ralph-multi.sh`);
    } catch (error) {
      console.log(`    ⚠ Failed to create ralph-multi symlink: ${error}`);
    }

    // Symlink autonomous-ralph.sh -> autonomous-ralph
    try {
      await this.exec(
        ["ln", "-sf", `${scriptsDir}/autonomous-ralph.sh`, `${ctx.binDir}/autonomous-ralph`],
        { cwd: ctx.homeDir }
      );
      console.log(`    ✓ autonomous-ralph → ${scriptsDir}/autonomous-ralph.sh`);
    } catch (error) {
      console.log(`    ⚠ Failed to create autonomous-ralph symlink: ${error}`);
    }

    console.log(`  ✓ ${this.name} installed from ${this.BRANCH} branch`);
    console.log(`\n  Usage:`);
    console.log(`    ralph "your task here"              # Start single-agent loop`);
    console.log(`    ralph-multi --agent-id foo "task"   # Start multi-agent loop`);
    console.log(`    autonomous-ralph                    # Start 12-hour self-improvement`);
  }
}
