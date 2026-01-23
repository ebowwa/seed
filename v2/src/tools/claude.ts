/**
 * Claude Code CLI Tool Installer
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class ClaudeTool extends BaseTool {
  name = "claude";
  description = "Claude Code CLI - AI-powered development assistant";

  async isApplicable(env: Environment): Promise<boolean> {
    // Claude CLI is useful for all environments
    return true;
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    return await this.commandExists("claude");
  }

  async install(env: Environment): Promise<void> {
    const ctx = this.getContext(env);

    console.log(`  Installing ${this.name}...`);

    // FIX: Use native installer instead of bun/npm (both deprecated)
    // bun install -g has known issues: https://github.com/anthropics/claude-code/issues/8304
    // See: https://www.reddit.com/r/ClaudeAI/comments/1ma3tkb/dont_use_bun_to_install_cc/
    //
    // Native installer works on both Linux and macOS:
    // - Linux: Installs to ~/.local/bin or /usr/local/bin
    // - macOS: Installs to /usr/local/bin (also available via Homebrew)

    let installScript: string;

    if (env.os === "macos") {
      // macOS: Try Homebrew first (faster, more reliable), fall back to native installer
      console.log("  Trying Homebrew installation (macOS)...");
      const brewProc = Bun.spawn(["brew", "install", "claude-code"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      const brewExitCode = await brewProc.exited;

      if (brewExitCode === 0) {
        console.log(`  ✓ ${this.name} installed via Homebrew`);
        return;
      }

      console.log("  Homebrew not available or failed, trying native installer...");
      installScript = "curl -fsSL https://cdn.jsdelivr.net/npm/@anthropic-ai/claude-code/install.sh | bash";
    } else {
      // Linux and other: Use native installer
      installScript = "curl -fsSL https://cdn.jsdelivr.net/npm/@anthropic-ai/claude-code/install.sh | bash";
    }

    const proc = Bun.spawn(["bash", "-c", installScript], {
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
