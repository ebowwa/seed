/**
 * Bash-Ops Tool Installer
 * Installs @ebowwa/bash-ops - comprehensive bash/shell operations module
 *
 * Bash-ops provides TypeScript utilities for:
 * - Filesystem operations (create, read, write, copy, delete)
 * - Process operations (exec, spawn, kill, ps)
 * - Network operations (http requests, dns, ping, port scan)
 * - Text processing (grep, sed, awk, sort, etc.)
 * - System operations (system info, services, cron, etc.)
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class BashOpsTool extends BaseTool {
  name = "bash-ops";
  description = "@ebowwa/bash-ops - Comprehensive bash/shell operations module for TypeScript";

  // NPM package configuration
  readonly NPM_PACKAGE = "@ebowwa/bash-ops";

  async isApplicable(env: Environment): Promise<boolean> {
    // Bash-ops is useful for all TypeScript/Node.js development
    // Skip in CI/CD where shell operations might be restricted
    return env.type !== "ci";
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    // Check if package is installed in the local node_modules
    // Note: This is a library, not a CLI tool, so we check for package existence
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

    // Install package with bun
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

    // Verify installation
    const packagePath = `${installDir}/node_modules/${this.NPM_PACKAGE}/package.json`;
    try {
      const { execSync } = await import("child_process");
      execSync(`test -f "${packagePath}"`, { stdio: "ignore" });
      console.log(`  ✓ ${this.name} installed from ${this.NPM_PACKAGE}`);
      console.log(`  → Usage: import { grep, exec, readFile, ... } from '${this.NPM_PACKAGE}'`);
    } catch {
      throw new Error(`Installation verification failed: ${packagePath} not found`);
    }
  }
}
