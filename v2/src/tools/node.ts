/**
 * Node.js & npm Tool Installer
 */

import type { Environment } from "../env/detect";
import { BaseTool } from "./base";

export class NodeTool extends BaseTool {
  name = "node";
  description = "Node.js and npm package manager";

  async isApplicable(env: Environment): Promise<boolean> {
    // Node.js is useful for all environments (macOS, Linux, WSL)
    return true;
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    const hasNode = await this.commandExists("node");
    const hasNpm = await this.commandExists("npm");
    return hasNode && hasNpm;
  }

  async install(env: Environment): Promise<void> {
    console.log(`  Installing ${this.name}...`);

    // Linux: Use apt package manager
    if (env.os === "linux") {
      if (!env.hasSudo && !env.isRoot) {
        console.log("  ⚠ Node.js installation requires sudo or root privileges");
        console.log("  Skipping Node.js installation (install manually with: sudo apt update && sudo apt install -y nodejs npm)");
        return;
      }

      // Remove problematic Yarn repository if it exists (expired GPG key)
      const yarnSource = "/etc/apt/sources.list.d/yarn.list";
      const removeYarnCmd = env.isRoot
        ? ["rm", "-f", yarnSource]
        : ["sudo", "rm", "-f", yarnSource];

      console.log("  Removing problematic Yarn repository (if exists)...");
      Bun.spawn(removeYarnCmd, {
        stdout: "inherit",
        stderr: "inherit",
      }).exited;

      // Update package list and install Node.js and npm
      const updateCmd = env.isRoot
        ? ["apt-get", "update", "-qq"]
        : ["sudo", "apt-get", "update", "-qq"];

      const installCmd = env.isRoot
        ? ["apt-get", "install", "-y", "nodejs", "npm"]
        : ["sudo", "apt-get", "install", "-y", "nodejs", "npm"];

      console.log("  Updating package list...");
      const updateProc = Bun.spawn(updateCmd, {
        stdout: "inherit",
        stderr: "inherit",
      });
      const updateExitCode = await updateProc.exited;

      if (updateExitCode !== 0) {
        throw new Error(`Failed to update package list`);
      }

      console.log("  Installing Node.js and npm...");
      const installProc = Bun.spawn(installCmd, {
        stdout: "inherit",
        stderr: "inherit",
      });
      const installExitCode = await installProc.exited;

      if (installExitCode !== 0) {
        throw new Error(`Failed to install ${this.name}`);
      }

      console.log(`  ✓ ${this.name} installed`);
    } else if (env.os === "macos") {
      // macOS: Try Homebrew
      console.log("  Installing Node.js via Homebrew (macOS)...");
      const brewProc = Bun.spawn(["brew", "install", "node"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      const brewExitCode = await brewProc.exited;

      if (brewExitCode !== 0) {
        console.log("  ⚠ Homebrew installation failed. Install Node.js manually:");
        console.log("    brew install node");
        return;
      }

      console.log(`  ✓ ${this.name} installed via Homebrew`);
    }
  }
}
