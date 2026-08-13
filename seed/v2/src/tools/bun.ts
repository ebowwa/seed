/**
 * Bun Tool Installer
 * Bun is already installed (we're running on it!), but we can verify/update
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class BunTool extends BaseTool {
  name = "bun";
  description = "Fast JavaScript runtime, package manager, and bundler";

  async isApplicable(env: Environment): Promise<boolean> {
    // Bun is applicable everywhere (we're running on it!)
    return true;
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    // We're running on Bun, so it's installed
    return true;
  }

  async install(env: Environment): Promise<void> {
    // Bun is already installed (this script is running on it!)
    // Just verify the version
    const { stdout } = await this.exec(["bun", "--version"]);
    console.log(`  ✓ ${this.name} ${stdout.trim()}`);
  }
}
