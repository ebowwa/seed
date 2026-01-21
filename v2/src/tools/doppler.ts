/**
 * Doppler CLI Tool Installer
 * Secrets management for development and production
 */

import type { Environment } from "../env/detect.ts";
import { BaseTool } from "./base.ts";

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

    // Doppler provides a curl install script
    const installCmd = `
      set -e
      curl -Ls https://cli.doppler.com/install.sh | sh
    `;

    const proc = Bun.spawn(["bash", "-c", installCmd], {
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env },
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(`Failed to install ${this.name}`);
    }

    console.log(`  ✓ ${this.name} installed`);
  }
}
