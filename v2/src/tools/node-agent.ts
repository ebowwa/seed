/**
 * Node Agent Tool Installer
 * Ralph Loop orchestration API server
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class NodeAgentTool extends BaseTool {
  name = "node-agent";
  description = "Ralph Loop orchestration API server for VPS nodes";

  async isApplicable(env: Environment): Promise<boolean> {
    // Install on all environments (prompt in interactive mode)
    return true;
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    return await this.commandExists("node-agent");
  }

  async install(env: Environment): Promise<void> {
    const ctx = this.getContext(env);

    // For now, we'll install from the seed repo's node-agent directory
    const seedPath = `${ctx.homeDir}/seed`;
    const agentPath = `${seedPath}/node-agent`;

    // Check if node-agent directory exists FIRST before prompting
    const { exitCode } = await this.exec([
      "test",
      "-d",
      agentPath,
    ]);

    if (exitCode !== 0) {
      console.log(`  ⊘ ${this.name} source not found at ${agentPath}, skipping`);
      return;
    }

    // Prompt in interactive mode
    const shouldInstall = await this.prompt(
      `Install ${this.name}? (Ralph Loop orchestration API server)`
    );

    if (!shouldInstall) {
      console.log(`  ⊘ Skipping ${this.name}`);
      return;
    }

    console.log(`  Installing ${this.name}...`);

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

    // Run node-agent after installation
    console.log(`  → Starting ${this.name}...`);

    if (env.type === "vps" || env.type === "container") {
      // On VPS/container, use systemd if available
      const serviceFile = `${agentPath}/systemd/node-agent.service`;
      const { exitCode: serviceExists } = await this.exec(["test", "-f", serviceFile]);

      if (serviceExists === 0) {
        // Set up systemd service
        const systemdDir = "/etc/systemd/system";
        const serviceUser = env.isRoot ? "root" : process.env.USER || "root";

        // Copy and configure service file
        await this.exec([
          "sudo", "cp", serviceFile, `${systemdDir}/node-agent.service`
        ]);
        await this.exec([
          "sudo", "sed", "-i", `s/User=ubuntu/User=${serviceUser}/g`,
          `${systemdDir}/node-agent.service`
        ]);
        await this.exec([
          "sudo", "sed", "-i", `s|/home/ubuntu/|/home/${serviceUser}/|g`,
          `${systemdDir}/node-agent.service`
        ]);

        // Create required directories
        const basePath = env.isRoot ? "/root" : `/home/${serviceUser}`;
        await this.exec(["sudo", "mkdir", "-p", `${basePath}/repos`]);
        await this.exec(["sudo", "mkdir", "-p", `${basePath}/.node-agent/pids`]);
        await this.exec(["sudo", "mkdir", "-p", `${basePath}/.node-agent/logs`]);

        // Set ownership
        if (!env.isRoot) {
          await this.exec(["sudo", "chown", "-R", `${serviceUser}:${serviceUser}`, basePath]);
        }

        // Reload and start service
        await this.exec(["sudo", "systemctl", "daemon-reload"]);
        await this.exec(["sudo", "systemctl", "enable", "node-agent.service"]);
        await this.exec(["sudo", "systemctl", "start", "node-agent.service"]);

        console.log(`  ✓ ${this.name} running as systemd service`);
      } else {
        // No systemd service file, run directly
        await this.runDirectly(agentPath);
      }
    } else {
      // Local dev - run in background
      await this.runDirectly(agentPath);
    }
  }

  private async runDirectly(agentPath: string): Promise<void> {
    // Run node-agent in background using bun
    const proc = Bun.spawn(
      ["bun", "run", "src/index.ts"],
      {
        cwd: agentPath,
        stdout: "inherit",
        stderr: "inherit",
        detached: true,
      }
    );

    // Don't wait for it - it runs in background
    proc.unref();
    console.log(`  ✓ ${this.name} started in background`);
  }
}
