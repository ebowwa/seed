/**
 * Doppler CLI Tool Installer
 * Secrets management for development and production
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class DopplerTool extends BaseTool {
  name = "doppler";
  description = "Doppler CLI - Secrets management for development";

  async isApplicable(env: Environment): Promise<boolean> {
    // Doppler is useful for all environments, especially VPS
    return true;
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    return await this.commandExists("doppler");
  }

  async install(env: Environment): Promise<void> {
    console.log(`  Installing ${this.name}...`);

    // TINKER: Simplified to just use sudo
    // Tried: User directory install with INSTALL_DIR variable
    // Issue: Doppler script ignores INSTALL_DIR, always uses dpkg
    // Solution: Use sudo directly, codespaces has it available
    const installCmd = `
      set -e
      curl -Ls https://cli.doppler.com/install.sh | sudo sh
    `;

    const proc = Bun.spawn(["bash", "-c", installCmd], {
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(`Failed to install ${this.name}`);
    }

    console.log(`  ✓ ${this.name} installed`);
  }
}
