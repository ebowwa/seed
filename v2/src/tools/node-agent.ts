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
    // Issue: process.cwd() is v2, need to check parent for node-agent
    // Solution: Try multiple common locations including parent of cwd
    const possiblePaths = [
      process.cwd(),                    // Current directory (might be v2)
      `${process.cwd()}/..`,            // Parent of current directory
      `${ctx.homeDir}/seed`,            // ~/seed
      `/workspaces/seed`,               // Codespaces
      `/home/${process.env.USER}/seed`, // Linux home
    ];

    let seedPath = "";
    let agentPath = "";

    for (const path of possiblePaths) {
      // Resolve relative paths to absolute paths
      let resolvedPath = path;
      if (path === "." || path === "./" || path.startsWith("..") || !path.startsWith("/")) {
        // Use realpath to resolve relative paths to absolute
        const { stdout } = await this.exec(["realpath", path]);
        resolvedPath = stdout.trim();
      }

      const testPath = `${resolvedPath}/node-agent`;
      const { exitCode } = await this.exec(["test", "-d", testPath]);
      if (exitCode === 0) {
        seedPath = resolvedPath;
        agentPath = testPath;
        break;
      }
    }

    // Check if node-agent directory was found
    if (!agentPath) {
      console.log(`  ⊘ ${this.name} source not found (tried: ${possiblePaths.join(", ")}), skipping`);
      return;
    }

    // Auto-install node-agent (always yes)
    console.log(`  ✓ Auto-installing ${this.name}...`);

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
    console.log(`  → ${this.name} will be started by systemd (managed by setup.sh)`);
  }
}
