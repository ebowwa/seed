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

    // Doppler provides a curl install script
    // In codespaces/containers, we need to use sudo or install to user dir
    const useSudo = env.hasSudo && !env.isRoot;
    const sudoPrefix = useSudo ? "sudo" : "";

    const installCmd = `
      set -e
      curl -Ls https://cli.doppler.com/install.sh | ${sudoPrefix} sh
    `;

    const proc = Bun.spawn(["bash", "-c", installCmd], {
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env },
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      // Try installing to user directory as fallback
      console.log(`  → Trying user directory installation...`);
      const userInstallCmd = `
        set -e
        curl -Ls https://cli.doppler.com/install.sh | INSTALL_DIR=$HOME/.local/bin sh
      `;
      const userProc = Bun.spawn(["bash", "-c", userInstallCmd], {
        stdout: "inherit",
        stderr: "inherit",
      });
      const userExitCode = await userProc.exited;
      if (userExitCode !== 0) {
        throw new Error(`Failed to install ${this.name}`);
      }
    }

    console.log(`  ✓ ${this.name} installed`);
  }
}
