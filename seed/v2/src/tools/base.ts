/**
 * Base Tool Class
 * Abstract base for tool installers
 */

import type { Environment } from "../env/detect";
import type { Tool } from "./registry";

export interface ToolContext {
  env: Environment;
  binDir: string;
  homeDir: string;
  configDir: string;
  cacheDir: string;
}

export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;

  protected installed: boolean = false;

  /**
   * Check if tool should be installed for this environment
   */
  abstract isApplicable(env: Environment): boolean | Promise<boolean>;

  /**
   * Install the tool
   */
  abstract install(env: Environment): Promise<void>;

  /**
   * Check if tool is already installed
   */
  abstract checkInstalled(env: Environment): boolean | Promise<boolean>;

  /**
   * Execute a shell command
   */
  protected async exec(
    command: string[],
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return { stdout, stderr, exitCode };
  }

  /**
   * Download a file to a specific path
   */
  protected async download(url: string, dest: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await Bun.write(dest, buffer);
  }

  /**
   * Ensure a directory exists
   * TINKER: Bun.mkdir() doesn't exist → TypeError: Bun.mkdir is not a function
   * Solution: Use shell `mkdir -p` command instead
   */
  protected async ensureDir(path: string): Promise<void> {
    const proc = Bun.spawn(["mkdir", "-p", path], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    // mkdir -p doesn't fail if directory exists
  }

  /**
   * Check if a command exists in PATH
   */
  protected async commandExists(cmd: string): Promise<boolean> {
    try {
      const proc = Bun.spawn(["which", cmd], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Make a file executable
   */
  protected async chmod(path: string, mode: string): Promise<void> {
    const proc = Bun.spawn(["chmod", mode, path], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to chmod ${path}`);
    }
  }

  /**
   * Get the context for this tool
   */
  protected getContext(env: Environment): ToolContext {
    return {
      env,
      binDir: env.binDir,
      homeDir: env.homeDir,
      configDir: env.configDir,
      cacheDir: env.cacheDir,
    };
  }

  /**
   * Check if running in interactive mode
   */
  protected isInteractive(): boolean {
    return (
      process.env.NONINTERACTIVE !== "1" &&
      process.env.CI !== "true" &&
      process.stdin.isTTY
    );
  }

  /**
   * Prompt user for yes/no input in interactive mode
   * Returns true if yes, false if no (or non-interactive)
   */
  protected async prompt(message: string): Promise<boolean> {
    if (!this.isInteractive()) {
      return true; // Default to yes in non-interactive mode
    }

    process.stdout.write(`${message} [Y/n] `);

    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.once("line", (line) => {
        rl.close();
        const answer = line.trim().toLowerCase();
        resolve(answer === "" || answer === "y" || answer === "yes");
      });
    });
  }
}
