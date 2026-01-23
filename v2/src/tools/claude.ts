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

    // Install Claude Code using the official installer
    // Works on macOS, Linux, and WSL
    const installScript = "curl -fsSL https://claude.ai/install.sh | bash";

    console.log("  Installing Claude Code via official installer...");
    console.log("  This works on macOS, Linux, and WSL");

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
