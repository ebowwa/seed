/**
 * Ralph Iterative Plugin Installer
 * Claude Code plugin for relentless task execution
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class RalphTool extends BaseTool {
  name = "ralph";
  description = "Ralph Iterative - Claude Code plugin for loop-until-completion task execution";

  // Ralph repository configuration
  readonly REPO_URL = "https://github.com/ebowwa/ralph.git";
  readonly CLONE_DIR = "~/ralph";

  async isApplicable(env: Environment): Promise<boolean> {
    // Ralph is useful for all environments where Claude Code is used
    return await this.commandExists("claude");
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    // Check if ralph plugin is installed
    const { execSync } = await import("child_process");
    try {
      const result = execSync("claude plugin list", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return result.includes("ralph-iterative");
    } catch {
      return false;
    }
  }

  async install(env: Environment): Promise<void> {
    const ctx = this.getContext(env);
    const cloneDir = ctx.homeDir + "/ralph";

    console.log(`  Installing ${this.name} from ${this.REPO_URL}...`);

    // Check if ralph directory already exists
    try {
      const { execSync } = await import("child_process");
      const exists = execSync(`test -d ${cloneDir} && echo "exists" || echo "not"`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (exists === "exists") {
        console.log(`  ✓ ${this.name} already cloned at ${cloneDir}`);
        console.log(`  → Updating to latest...`);

        // Fetch and pull latest
        await this.exec(["git", "-C", cloneDir, "fetch", "origin"], { cwd: cloneDir });
        await this.exec(["git", "-C", cloneDir, "pull", "origin", "main"], { cwd: cloneDir });
      } else {
        // Clone the repository
        console.log(`  → Cloning to ${cloneDir}...`);
        await this.exec(
          ["git", "clone", this.REPO_URL, cloneDir],
          { cwd: ctx.homeDir }
        );
      }
    } catch (error) {
      throw new Error(`Failed to clone ralph: ${error}`);
    }

    // Add marketplace and install plugin
    console.log(`  → Adding marketplace to Claude Code...`);
    try {
      await this.exec(
        ["claude", "plugin", "marketplace", "add", cloneDir, "--name", "ralph"],
        { cwd: ctx.homeDir }
      );
    } catch (error) {
      // Marketplace might already exist, try with replace flag
      console.log(`  → Marketplace might exist, updating...`);
      try {
        await this.exec(
          ["claude", "plugin", "marketplace", "remove", "ralph"],
          { cwd: ctx.homeDir }
        );
        await this.exec(
          ["claude", "plugin", "marketplace", "add", cloneDir, "--name", "ralph"],
          { cwd: ctx.homeDir }
        );
      } catch {
        throw new Error(`Failed to add marketplace: ${error}`);
      }
    }

    console.log(`  → Installing ralph-iterative plugin...`);
    try {
      await this.exec(
        ["claude", "plugin", "install", "ralph-iterative"],
        { cwd: ctx.homeDir }
      );
    } catch (error) {
      throw new Error(`Failed to install ralph plugin: ${error}`);
    }

    console.log(`  ✓ ${this.name} plugin installed`);
    console.log(`     Use: /ralph-iterative "task" --completion-promise "PROMISE"`);
  }
}
