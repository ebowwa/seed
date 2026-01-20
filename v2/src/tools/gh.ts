/**
 * GitHub CLI Tool Installer
 */

import type { Environment } from "../env/detect.js";
import { BaseTool } from "./base.js";

export class GhTool extends BaseTool {
  name = "gh";
  description = "GitHub CLI - Official GitHub command-line tool";

  async isApplicable(env: Environment): Promise<boolean> {
    // GitHub CLI is useful for all environments
    return true;
  }

  async checkInstalled(env: Environment): Promise<boolean> {
    return await this.commandExists("gh");
  }

  async install(env: Environment): Promise<void> {
    console.log(`  Installing ${this.name}...`);

    // Detect OS and install accordingly
    if (env.os === "macos") {
      await this.installOnMac(env);
    } else if (env.os === "linux") {
      await this.installOnLinux(env);
    } else {
      throw new Error(`Unsupported OS for ${this.name}: ${env.os}`);
    }

    console.log(`  ✓ ${this.name} installed`);
  }

  private async installOnMac(env: Environment): Promise<void> {
    // Use Homebrew on macOS
    const proc = Bun.spawn(["brew", "install", "gh"], {
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(`Failed to install ${this.name} via Homebrew`);
    }
  }

  private async installOnLinux(env: Environment): Promise<void> {
    // Download and install from GitHub releases
    const arch = env.arch === "arm64" ? "arm64" : "amd64";
    const version = "2.40.1"; // Latest stable version
    const url = `https://github.com/cli/cli/releases/download/v${version}/gh_${version}_linux_${arch}.deb`;
    const debPath = `/tmp/gh_${version}_linux_${arch}.deb`;

    // Download
    await this.download(url, debPath);

    // Install
    const proc = Bun.spawn(
      ["sudo", "dpkg", "-i", debPath],
      {
        stdout: "inherit",
        stderr: "inherit",
      }
    );

    const exitCode = await proc.exited;

    // Cleanup
    await this.exec(["rm", "-f", debPath]);

    if (exitCode !== 0) {
      throw new Error(`Failed to install ${this.name} from deb package`);
    }
  }
}
