/**
 * Claude Code CLI Tool Installer
 */

import type { Environment } from "../env/detect.ts";
import { BaseTool } from "./base.ts";

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

    // Claude is installed via npm
    const cmd = env.isRoot
      ? ["npm", "install", "-g", "@anthropic-ai/claude-code"]
      : ["bun", "install", "-g", "@anthropic-ai/claude-code"];

    const proc = Bun.spawn(cmd, {
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
