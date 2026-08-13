/**
 * Workspace MCP Tool Installer
 * Installs @ebowwa/workspace-mcp - Workspace management MCP server
 *
 * Provides tools for:
 * - Directory and file operations
 * - Service management
 * - Command execution
 * - Workspace analysis
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class WorkspaceMCPTool extends BaseTool {
  name = "workspace-mcp";
  description = "@ebowwa/workspace-mcp - Workspace management (directories, services, files)";

  readonly NPM_PACKAGE = "@ebowwa/workspace-mcp";

  async isApplicable(env: Environment): Promise<boolean> {
    // Workspace MCP is useful for all environments
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
      console.log(`  → MCP server: mcp-workspace`);
    } catch {
      throw new Error(`Installation verification failed: ${packagePath} not found`);
    }
  }
}
