/**
 * Node Agent Tool Installer
 * Ralph Loop orchestration API server
 */

import type { Environment } from "../env/detect.js";
import { BaseTool } from "./base.js";

export class NodeAgentTool extends BaseTool {
  name = "node-agent";
  description = "Ralph Loop orchestration API server for VPS nodes";

  async isApplicable(env: Environment): Promise<boolean> {
    // Only install on VPS environments
    return env.type === "vps" || env.type === "container";
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    return await this.commandExists("node-agent");
  }

  async install(env: Environment): Promise<void> {
    const ctx = this.getContext(env);

    // For now, we'll install from the seed repo's node-agent directory
    const seedPath = `${ctx.homeDir}/seed`;
    const agentPath = `${seedPath}/node-agent`;

    console.log(`  Installing ${this.name}...`);

    // Check if node-agent directory exists
    const { exitCode } = await this.exec([
      "test",
      "-d",
      agentPath,
    ]);

    if (exitCode !== 0) {
      console.log(`  ⚠ ${this.name} source not found at ${agentPath}`);
      console.log(`  ℹ Skipping ${this.name} installation`);
      return;
    }

    // Install dependencies
    console.log(`  → Installing dependencies...`);
    const installProc = Bun.spawn(
      ["bun", "install"],
      {
        cwd: agentPath,
        stdout: "inherit",
        stderr: "inherit",
      }
    );
    const installExitCode = await installProc.exited;

    if (installExitCode !== 0) {
      throw new Error(`Failed to install ${this.name} dependencies`);
    }

    // Build the agent
    console.log(`  → Building ${this.name}...`);
    const buildProc = Bun.spawn(
      ["bun", "build", "src/index.ts", "--outdir", "dist"],
      {
        cwd: agentPath,
        stdout: "inherit",
        stderr: "inherit",
      }
    );
    const buildExitCode = await buildProc.exited;

    if (buildExitCode !== 0) {
      throw new Error(`Failed to build ${this.name}`);
    }

    // Create symlink to bin directory
    const binPath = `${ctx.binDir}/node-agent`;
    await this.ensureDir(ctx.binDir);

    try {
      // Remove existing symlink if present
      await this.exec(["rm", "-f", binPath]);
    } catch {}

    // Create symlink to the run script
    const runScript = `${agentPath}/src/index.ts`;
    await this.exec([
      "ln",
      "-sf",
      runScript,
      binPath,
    ]);

    // Make it executable (not needed for TypeScript, but good practice)
    await this.exec(["chmod", "+x", binPath]);

    console.log(`  ✓ ${this.name} installed to ${binPath}`);
  }
}
