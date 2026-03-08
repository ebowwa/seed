/**
 * Git MCP Tool Installer
 * Installs @ebowwa/git-mcp - Git operations MCP server
 *
 * Provides tools for:
 * - Multi-repo Git operations
 * - Diff viewing and comparison
 * - Log and history viewing
 * - Branch management
 * - Repository synchronization
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class GitMCPTool extends BaseTool {
  name = "git-mcp";
  description = "@ebowwa/git-mcp - Git operations (diff, log, branches, multi-repo)";

  readonly NPM_PACKAGE = "@ebowwa/git-mcp";

  async isApplicable(env: Environment): Promise<boolean> {
    // Git MCP is useful for all development environments
    return env.type !== "ci";
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    const ctx = this.getContext(env);
    const packagePath = `${ctx.homeDir}/node_modules/${this.NPM_PACKAGE}/package.json`;

    try {
      const { execSync } = await import("child_process");
      execSync(`test -f "${packagePath}"`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async install(env: Environment): Promise<void> {
    const ctx = this.getContext(env);
    const installDir = ctx.homeDir;

    console.log(`  Installing ${this.name} from npm (${this.NPM_PACKAGE})...`);

    console.log(`  → Running: bun install ${this.NPM_PACKAGE}...`);
    const installProc = Bun.spawn(
      ["bun", "install", this.NPM_PACKAGE],
      {
        cwd: installDir,
        stdout: "inherit",
        stderr: "inherit",
      }
    );

    const exitCode = await installProc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to install ${this.name} from npm`);
    }

    const packagePath = `${installDir}/node_modules/${this.NPM_PACKAGE}/package.json`;
    try {
      const { execSync } = await import("child_process");
      execSync(`test -f "${packagePath}"`, { stdio: "ignore" });
      console.log(`  ✓ ${this.name} installed from ${this.NPM_PACKAGE}`);
      console.log(`  → MCP server: git-mcp`);
    } catch {
      throw new Error(`Installation verification failed: ${packagePath} not found`);
    }
  }
}
