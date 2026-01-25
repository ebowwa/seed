#!/usr/bin/env bun
/**
 * Seed Setup v2 - Main Entry Point
 * Fast, reliable environment setup powered by Bun
 */

// TINKER: Import path resolution
// Originally used ".js" extensions (ESM standard) → Bun couldn't find modules
// Then tried ".ts" extensions → Still didn't work
// Solution: Use no extensions, Bun resolves them correctly
import { detectEnvironment } from "./env/detect";
import { installPackages } from "./env/packages";
import { ToolRegistry } from "./tools/registry";
import { healthCheck } from "./health/check";

// ============================================================================
// CLI Interface
// ============================================================================

interface SetupOptions {
  force?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  skip?: string[];
  only?: string[];
  aiAssistant?: "claude" | "codex" | "zai";
}

async function main() {
  const args = process.argv.slice(2);

  // Start overall timer
  const startTime = performance.now();

  // Parse CLI arguments
  const options: SetupOptions = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--force":
      case "-f":
        options.force = true;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--skip":
        options.skip = options.skip || [];
        options.skip.push(args[++i]);
        break;
      case "--only":
        options.only = options.only || [];
        options.only.push(args[++i]);
        break;
      case "--ai":
      case "--ai-assistant":
        options.aiAssistant = args[++i] as SetupOptions["aiAssistant"];
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        positional.push(arg);
    }
  }

  // Enable verbose logging
  if (options.verbose) {
    process.env.SEED_VERBOSE = "1";
  }

  // Banner
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Seed Setup v2 - Fast Environment Bootstrap               ║
║  Powered by Bun • TypeScript • Zero Runtime Deps          ║
╚════════════════════════════════════════════════════════════╝
`);

  // Detect environment
  const env = await detectEnvironment();

  log("info", `Environment: ${env.type}`);
  log("info", `OS: ${env.os} ${env.arch}`);
  log("info", `Platform: ${env.platform}`);

  if (options.verbose) {
    log("debug", `Environment details:`, env);
  }

  // Handle positional commands
  const command = positional[0];

  if (command === "health") {
    log("info", "Running health check...");
    const health = await healthCheck(env);
    console.log(JSON.stringify(health, null, 2));
    return;
  }

  if (command === "list") {
    log("info", "Available tools:");
    const registry = new ToolRegistry(env);
    const tools = await registry.listTools();
    for (const tool of tools) {
      const status = tool.installed ? "✓" : "○";
      console.log(`  ${status} ${tool.name} - ${tool.description}`);
    }
    return;
  }

  // Default: run setup
  log("info", "Starting setup...");

  // Install package manager if needed
  await installPackages(env, options);

  // Initialize tool registry
  const registry = new ToolRegistry(env, options);

  // Filter tools based on options
  let toolsToInstall = await registry.getToolsForEnvironment();

  if (options.only?.length) {
    toolsToInstall = toolsToInstall.filter((t) =>
      options.only!.includes(t.name)
    );
  }

  if (options.skip?.length) {
    toolsToInstall = toolsToInstall.filter(
      (t) => !options.skip!.includes(t.name)
    );
  }

  // Install tools with timing
  // TINKER: Added performance tracking to measure each tool install time
  log("info", `Installing ${toolsToInstall.length} tools...`);

  const timings: Array<{ name: string; ms: number; status: string }> = [];

  // ============================================================================
  // 4-PHASE PARALLEL INSTALLATION STRATEGY
  // ============================================================================
  // Phase 1: curl-based installers (claude, doppler) - no dependencies
  // Phase 2: bun (verification only, script runs on it)
  // Phase 3: bun-dependent tools (lane, node-agent) - require bun for build
  // Phase 4: apt-based tools (node, tmux, gh) - serial due to dpkg lock
  // ============================================================================

  const curlTools = toolsToInstall.filter((t) =>
    ["claude", "doppler"].includes(t.name)
  );
  const bunTool = toolsToInstall.find((t) => t.name === "bun");
  const bunDependentTools = toolsToInstall.filter((t) =>
    ["lane", "node-agent"].includes(t.name)
  );
  const aptTools = toolsToInstall.filter((t) =>
    ["node", "tmux", "gh"].includes(t.name)
  );

  // Helper function to run tools in parallel
  const runToolsParallel = async (tools: Tool[]): Promise<Array<{ name: string; ms: number; status: string }>> => {
    if (tools.length === 0) return [];

    if (options.dryRun) {
      for (const tool of tools) {
        log("dry-run", `Would install: ${tool.name}`);
      }
      return tools.map(t => ({ name: t.name, ms: 0, status: "○" }));
    }

    const startTimes = new Map(tools.map((t) => [t.name, performance.now()]));

    const installPromises = tools.map(async (tool) => {
      try {
        log("info", `Installing ${tool.name}...`);
        await tool.install(env);
        const toolEnd = performance.now();
        const toolMs = Math.round(toolEnd - startTimes.get(tool.name)!);
        return { name: tool.name, ms: toolMs, status: "✓" };
      } catch (error) {
        const toolEnd = performance.now();
        const toolMs = Math.round(toolEnd - startTimes.get(tool.name)!);
        const result = { name: tool.name, ms: toolMs, status: "✗" };
        log("error", `${tool.name} failed: ${error}`);
        if (!options.force) {
          throw error;
        }
        return result;
      }
    });

    const results = await Promise.all(installPromises);

    for (const result of results) {
      if (result.status === "✓") {
        log("success", `${result.name} installed (${result.ms}ms)`);
      }
    }

    return results;
  };

  // Helper function to run tools serially
  const runToolsSerial = async (tools: Tool[]): Promise<Array<{ name: string; ms: number; status: string }>> => {
    const results: Array<{ name: string; ms: number; status: string }> = [];

    for (const tool of tools) {
      if (options.dryRun) {
        log("dry-run", `Would install: ${tool.name}`);
        results.push({ name: tool.name, ms: 0, status: "○" });
        continue;
      }

      const toolStart = performance.now();
      try {
        log("info", `Installing ${tool.name}...`);
        await tool.install(env);
        const toolEnd = performance.now();
        const toolMs = Math.round(toolEnd - toolStart);
        results.push({ name: tool.name, ms: toolMs, status: "✓" });
        log("success", `${tool.name} installed (${toolMs}ms)`);
      } catch (error) {
        const toolEnd = performance.now();
        const toolMs = Math.round(toolEnd - toolStart);
        results.push({ name: tool.name, ms: toolMs, status: "✗" });
        log("error", `${tool.name} failed: ${error}`);
        if (!options.force) {
          throw error;
        }
      }
    }

    return results;
  };

  // ============================================================================
  // PHASE 1: curl-based installers (no dependencies)
  // Tools: claude, doppler
  // ============================================================================
  if (curlTools.length > 0) {
    const phaseStart = performance.now();
    log("info", `Phase 1: Installing ${curlTools.length} curl-based tools in parallel...`);
    const results = await runToolsParallel(curlTools);
    timings.push(...results);
    const phaseEnd = performance.now();
    log("success", `Phase 1 complete (${Math.round(phaseEnd - phaseStart)}ms)`);
  }

  // ============================================================================
  // PHASE 2: bun (verification only)
  // Tools: bun
  // ============================================================================
  if (bunTool) {
    const phaseStart = performance.now();
    log("info", `Phase 2: Verifying bun...`);
    const results = await runToolsSerial([bunTool]);
    timings.push(...results);
    const phaseEnd = performance.now();
    log("success", `Phase 2 complete (${Math.round(phaseEnd - phaseStart)}ms)`);
  }

  // ============================================================================
  // PHASE 3: bun-dependent tools (require bun for build/install)
  // Tools: lane, node-agent
  // ============================================================================
  if (bunDependentTools.length > 0) {
    const phaseStart = performance.now();
    log("info", `Phase 3: Installing ${bunDependentTools.length} bun-dependent tools in parallel...`);
    const results = await runToolsParallel(bunDependentTools);
    timings.push(...results);
    const phaseEnd = performance.now();
    log("success", `Phase 3 complete (${Math.round(phaseEnd - phaseStart)}ms)`);
  }

  // ============================================================================
  // PHASE 4: apt-based tools (serial due to dpkg lock)
  // Tools: node, tmux, gh
  // ============================================================================
  if (aptTools.length > 0) {
    const phaseStart = performance.now();
    log("info", `Phase 4: Installing ${aptTools.length} apt-based tools serially...`);
    const results = await runToolsSerial(aptTools);
    timings.push(...results);
    const phaseEnd = performance.now();
    log("success", `Phase 4 complete (${Math.round(phaseEnd - phaseStart)}ms)`);
  }

  // Run health check
  log("info", "Verifying installation...");
  const health = await healthCheck(env);

  // Configure PATH for bun
  await configureBunPath();

  // Calculate total time
  const endTime = performance.now();
  const totalMs = Math.round(endTime - startTime);

  const issues = health.issues.filter((i) => i.severity === "error");
  if (issues.length > 0) {
    log("warning", "Setup completed with issues:");
    for (const issue of issues) {
      console.log(`  - ${issue.message}`);
    }
  } else {
    log("success", "Setup complete! 🎉");
  }

  // Format timings table
  const timingsTable = timings
    .map((t) => `  ${t.status} ${t.name.padEnd(15)} ${t.ms.toString().padStart(5)}ms`)
    .join("\n");

  // Show summary
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment: ${env.type}
  Tools Installed: ${health.tools.filter((t) => t.installed).length}/${health.tools.length}
  Health: ${issues.length === 0 ? "✓ All good" : `${issues.length} issues`}
  Total Time: ${totalMs}ms

${timingsTable}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

// ============================================================================
// Logging Utilities
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function log(
  level: "info" | "success" | "warning" | "error" | "debug" | "dry-run",
  message: string,
  ...args: unknown[]
) {
  const timestamp = new Date().toLocaleTimeString();
  const color =
    {
      info: colors.blue,
      success: colors.green,
      warning: colors.yellow,
      error: colors.red,
      debug: colors.gray,
      "dry-run": colors.gray,
    }[level] || colors.reset;

  const prefix = {
    info: "ℹ",
    success: "✓",
    warning: "⚠",
    error: "✗",
    debug: "◦",
    "dry-run": "[dry-run]",
  }[level];

  console.log(
    `${color}${prefix} ${timestamp} ${message}${colors.reset}`,
    ...args
  );
}

async function configureBunPath() {
  const bunPath = `${process.env.HOME}/.bun/bin`;
  const pathLine = `export PATH="${bunPath}:$PATH"`;

  // Map shells to their config files
  const shellConfigs: Record<string, string[]> = {
    zsh: [`${process.env.HOME}/.zshrc`],
    bash: [
      `${process.env.HOME}/.bashrc`,
      `${process.env.HOME}/.bash_profile`,
    ],
    sh: [`${process.env.HOME}/.profile`],
  };

  // Detect current shell and build config priority list
  const currentShell = process.env.SHELL?.split("/").pop() || "bash";
  const priorityConfigs = shellConfigs[currentShell] || shellConfigs.bash;

  // Add fallback configs (ones not in priority list)
  const allFallbackConfigs: string[] = [];
  for (const configs of Object.values(shellConfigs)) {
    for (const config of configs) {
      if (!priorityConfigs.includes(config)) {
        allFallbackConfigs.push(config);
      }
    }
  }

  const allConfigs = [...priorityConfigs, ...allFallbackConfigs];

  // First, try /etc/environment (system-wide, requires sudo)
  const envFile = "/etc/environment";
  let configured = false;

  try {
    const content = await Bun.file(envFile).text();
    if (content.includes(bunPath)) {
      log("info", "Bun PATH already configured in /etc/environment");
      return;
    }
  } catch {
    // /etc/environment not readable, try shell configs
  }

  try {
    const content = await Bun.file(envFile).text();
    const updated = content.trim() + `\nPATH="${bunPath}:$PATH"\n`;
    await Bun.write(envFile, updated);
    log("success", `Added bun PATH to ${envFile}`);
    configured = true;
  } catch {
    // No sudo or write failed, continue to shell configs
  }

  // If system-wide failed, try shell config files
  if (!configured) {
    for (const configPath of allConfigs) {
      try {
        // Check if file exists
        const existsProc = Bun.spawn(["test", "-f", configPath], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const exitCode = await existsProc.exited;

        let content = "";
        if (exitCode === 0) {
          content = await Bun.file(configPath).text();
          // Check if already configured
          if (content.includes(bunPath)) {
            log("info", `Bun PATH already configured in ${configPath}`);
            return;
          }
        }

        // Append PATH configuration
        const updated = content.trim() + `\n${pathLine}\n`;
        await Bun.write(configPath, updated);
        log("success", `Added bun PATH to ${configPath}`);
        return;
      } catch {
        // Try next config file
        continue;
      }
    }

    log("warning", "Could not configure bun PATH in any shell config");
    log("info", `Add this to your shell config: export PATH="${bunPath}:$PATH"`);
  }
}

function showHelp() {
  console.log(`
Seed Setup v2 - Fast Environment Bootstrap

USAGE:
  setup [OPTIONS] [COMMAND]

COMMANDS:
  (none)              Run full setup
  health              Check system health and tool status
  list                List available tools

OPTIONS:
  -f, --force         Continue on errors
  -v, --verbose       Enable verbose logging
  --dry-run           Show what would be done without doing it
  --skip <tool>       Skip installing a specific tool
  --only <tool>       Only install specific tools
  --ai <assistant>    Set AI assistant (claude, codex, zai)
  -h, --help          Show this help message

EXAMPLES:
  setup                     # Run full setup
  setup --only bun node     # Only install Bun and Node
  setup --skip docker       # Skip Docker installation
  setup health              # Check system health
  setup -v --dry-run        # Preview setup in verbose mode

ENVIRONMENT VARIABLES:
  NONINTERACTIVE=1          Run without prompts
  SEED_VERBOSE=1            Enable debug logging
  CI=1                      Enable CI mode
`);
}

// ============================================================================
// Bootstrap
// ============================================================================

main().catch((error) => {
  log("error", "Setup failed:", error);
  process.exit(1);
});
