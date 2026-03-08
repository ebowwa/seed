/**
 * Lane CLI Tool Installer
 * Installs lane from npm using bun
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class LaneTool extends BaseTool {
  name = "lane";
  description = "Lane CLI - Git worktree alternative for parallel development";

  // NPM package configuration
  readonly NPM_PACKAGE = "@ebowwa/lane";

  async isApplicable(env: Environment): Promise<boolean> {
    // Lane is useful for all environments where git work is done
    // Skip in CI/CD where worktrees aren't needed
    return env.type !== "ci";
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    return await this.commandExists("lane");
  }

  async install(env: Environment): Promise<void> {
    const ctx = this.getContext(env);
    const installDir = ctx.homeDir + "/.lane-install";

    console.log(`  Installing ${this.name} from npm (${this.NPM_PACKAGE})...`);

    // Create temp install directory
    await this.exec(["mkdir", "-p", installDir]);

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

    // Create symlink to ~/.local/bin
    console.log(`  → Creating symlink to ~/.local/bin/lane...`);
    const binDir = ctx.homeDir + "/.local/bin";
    await this.exec(["mkdir", "-p", binDir]);

    const symlinkPath = binDir + "/lane";
    const targetPath = installDir + "/node_modules/.bin/lane";

    // Remove existing symlink if it exists
    await this.exec(["rm", "-f", symlinkPath]);

    // Create new symlink
    await this.exec(["ln", "-s", targetPath, symlinkPath]);

    // Set up shell completion
    console.log(`  → Setting up shell integration...`);
    try {
      await this.exec(
        ["lane", "init-shell"],
        { cwd: ctx.homeDir, env: { ...process.env, HOME: ctx.homeDir } }
      );
    } catch {
      // init-shell might fail if shell config is weird, non-fatal
      console.log(`  ⚠ Shell integration skipped (you can run 'lane init-shell' manually)`);
    }

    console.log(`  ✓ ${this.name} installed from ${this.NPM_PACKAGE}`);
  }
}
