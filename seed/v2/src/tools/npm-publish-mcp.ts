/**
 * NPM Publish MCP Tool Installer
 * Installs @ebowwa/npm-publish-mcp - NPM publishing and version management MCP server
 *
 * Provides tools for:
 * - Package publishing (publish, unpublish, deprecate)
 * - Version management (bump major/minor/patch)
 * - Dist-tag management
 * - Registry validation
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class NpmPublishMCPTool extends BaseTool {
  name = "npm-publish-mcp";
  description = "@ebowwa/npm-publish-mcp - NPM package publishing and version management";

  readonly NPM_PACKAGE = "@ebowwa/npm-publish-mcp";

  async isApplicable(env: Environment): Promise<boolean> {
    // NPM publish MCP is useful for all development environments
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
      console.log(`  → MCP server: npm-publish-mcp`);
    } catch {
      throw new Error(`Installation verification failed: ${packagePath} not found`);
    }
  }
}
