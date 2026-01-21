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

    // TINKER: Multi-location path detection
    // Original: Only checked ${ctx.homeDir}/seed
    // Issue: Codespaces uses /workspaces/seed, not ~/seed
    // Solution: Try multiple common locations
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
    // TINKER: Add --target bun for Node.js built-ins
    // Issue: Browser build cannot import Node.js builtin: "child_process"
    // Solution: --target bun tells Bun to build for Bun runtime, not browser
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
    // TINKER: Shell wrapper instead of symlink to .ts file
    // Issue: Symlink to src/index.ts caused ENOEXEC (can't execute .ts directly)
    // Solution: Create executable shell wrapper that runs with bun
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
    // TINKER: Check if port already in use before spawning
    // Issue: EADDRINUSE error when trying to start second instance
    // Solution: Check port 8911 with lsof/netstat before starting
    const { exitCode: portCheck } = await this.exec([
      "sh", "-c",
      "lsof -i :8911 >/dev/null 2>&1 || netstat -tlnp 2>/dev/null | grep :8911 >/dev/null || true"
    ]);

    if (portCheck === 0) {
      console.log(`  ✓ ${this.name} already running on port 8911`);
      return;
    }

    // TINKER: Use nohup with background and verify it started
    // Issue: setsid might not be available, need to verify process started
    // Solution: Use nohup, wait 1s, then check if port is listening
    const logFile = `${agentPath}/node-agent.log`;
    const startCmd = `cd "${agentPath}" && nohup bun run src/index.ts >> "${logFile}" 2>&1 &`;
    const proc = Bun.spawn(["sh", "-c", startCmd], {
      cwd: agentPath,
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;

    // Wait for process to start and open port
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify it's actually running
    const { exitCode: verifyCheck } = await this.exec([
      "sh", "-c",
      "lsof -i :8911 >/dev/null 2>&1 || netstat -tlnp 2>/dev/null | grep :8911 >/dev/null || true"
    ]);

    if (verifyCheck !== 0) {
      console.log(`  ✗ ${this.name} failed to start`);
      // Show last 10 lines of log
      try {
        const tailProc = Bun.spawn(["tail", "-n", "10", logFile], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const logOutput = await new Response(tailProc.stdout).text();
        await tailProc.exited;
        console.log(`  Log output:\n${logOutput.split("\n").map(l => "    " + l).join("\n")}`);
      } catch {}
      return;
    }

    console.log(`  ✓ ${this.name} started and listening on port 8911 (logs: ${logFile})`);
  }
}
