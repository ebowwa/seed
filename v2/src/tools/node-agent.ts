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

    // Find seed repo: try common locations
    const possiblePaths = [
      process.cwd(),                    // Current directory
      `${ctx.homeDir}/seed`,            // ~/seed
      `/workspaces/seed`,               // Codespaces
      `/home/${process.env.USER}/seed`, // Linux home
    ];

    let seedPath = "";
    let agentPath = "";

    for (const path of possiblePaths) {
      const testPath = `${path}/node-agent`;
      const { exitCode } = await this.exec(["test", "-d", testPath]);
      if (exitCode === 0) {
        seedPath = path;
        agentPath = testPath;
        break;
      }
    }

    // Check if node-agent directory was found
    if (!agentPath) {
      console.log(`  ⊘ ${this.name} source not found (tried: ${possiblePaths.join(", ")}), skipping`);
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
      ["bun", "build", "src/index.ts", "--target", "bun", "--outdir", "dist"],
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

    // Create wrapper script in bin directory
    const binPath = `${ctx.binDir}/node-agent`;
    await this.ensureDir(ctx.binDir);

    try {
      // Remove existing if present
      await this.exec(["rm", "-f", binPath]);
    } catch {}

    // Create a shell wrapper script that runs the TypeScript file with bun
    const wrapperContent = `#!/bin/bash
cd "${agentPath}" || exit 1
bun run src/index.ts "$@"
`;

    // Write the wrapper script
    const writeProc = Bun.spawn([
      "sh",
      "-c",
      `cat > "${binPath}" << 'WRAPPER_EOF'
${wrapperContent}
WRAPPER_EOF`
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await writeProc.exited;

    // Make it executable
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
    // Check if node-agent is already running on port 8911
    const { exitCode: portCheck } = await this.exec([
      "sh", "-c",
      "lsof -i :8911 >/dev/null 2>&1 || netstat -tlnp 2>/dev/null | grep :8911 >/dev/null || true"
    ]);

    if (portCheck === 0) {
      console.log(`  ✓ ${this.name} already running on port 8911`);
      return;
    }

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
