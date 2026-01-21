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

    // Try user directory installation first (works in codespaces without sudo)
    console.log(`  → Installing to user directory...`);
    const userInstallCmd = `
      set -e
      mkdir -p $HOME/.local/bin
      curl -Ls https://cli.doppler.com/install.sh | INSTALL_DIR=$HOME/.local/bin sh
    `;

    const userProc = Bun.spawn(["bash", "-c", userInstallCmd], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const userExitCode = await userProc.exited;

    if (userExitCode !== 0) {
      // Try system installation with sudo as fallback
      if (env.hasSudo && !env.isRoot) {
        console.log(`  → Trying system installation with sudo...`);
        const systemInstallCmd = `
          set -e
          curl -Ls https://cli.doppler.com/install.sh | sudo sh
        `;
        const systemProc = Bun.spawn(["bash", "-c", systemInstallCmd], {
          stdout: "inherit",
          stderr: "inherit",
        });
        const systemExitCode = await systemProc.exited;
        if (systemExitCode !== 0) {
          throw new Error(`Failed to install ${this.name}`);
        }
      } else {
        throw new Error(`Failed to install ${this.name}`);
      }
    }

    console.log(`  ✓ ${this.name} installed`);
  }
}
