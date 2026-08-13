/**
 * Tmux Terminal Multiplexer Tool Installer
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class TmuxTool extends BaseTool {
  name = "tmux";
  description = "Terminal multiplexer for persistent sessions";

  async isApplicable(env: Environment): Promise<boolean> {
    // Tmux is useful for VPS and Linux environments
    return env.os === "linux" || env.os === "macos";
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    return await this.commandExists("tmux");
  }

  async install(env: Environment): Promise<void> {
    console.log(`  Installing ${this.name}...`);

    if (env.os === "linux") {
      if (!env.hasSudo && !env.isRoot) {
        console.log("  ⚠ tmux installation requires sudo or root privileges");
        console.log("  Skipping tmux installation (install manually with: sudo apt install -y tmux)");
        return;
      }

      // Install tmux using apt
      const installCmd = env.isRoot
        ? ["apt-get", "install", "-y", "tmux"]
        : ["sudo", "apt-get", "install", "-y", "tmux"];

      const proc = Bun.spawn(installCmd, {
        stdout: "inherit",
        stderr: "inherit",
      });
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        throw new Error(`Failed to install ${this.name}`);
      }

      console.log(`  ✓ ${this.name} installed`);

    } else if (env.os === "macos") {
      // macOS: Try Homebrew first
      console.log("  Trying Homebrew installation (macOS)...");
      const brewProc = Bun.spawn(["brew", "install", "tmux"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      const brewExitCode = await brewProc.exited;

      if (brewExitCode === 0) {
        console.log(`  ✓ ${this.name} installed via Homebrew`);
        return;
      }

      console.log("  ⚠ Homebrew not available. Install tmux manually:");
      console.log("    brew install tmux");
    }
  }
}
