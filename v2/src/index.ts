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

  for (const tool of toolsToInstall) {
    if (options.dryRun) {
      log("dry-run", `Would install: ${tool.name}`);
      continue;
    }

    const toolStart = performance.now();

    try {
      log("info", `Installing ${tool.name}...`);
      await tool.install(env);
      const toolEnd = performance.now();
      const toolMs = Math.round(toolEnd - toolStart);
      timings.push({ name: tool.name, ms: toolMs, status: "✓" });
      log("success", `${tool.name} installed (${toolMs}ms)`);
    } catch (error) {
      const toolEnd = performance.now();
      const toolMs = Math.round(toolEnd - toolStart);
      timings.push({ name: tool.name, ms: toolMs, status: "✗" });
      log("error", `${tool.name} failed: ${error}`);
      if (!options.force) {
        throw error;
      }
    }
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
  const envFile = "/etc/environment";
  const bunPath = `${process.env.HOME}/.bun/bin`;

  try {
    const content = await Bun.file(envFile).text();
    if (content.includes(bunPath)) {
      log("info", "Bun PATH already configured in /etc/environment");
      return;
    }
  } catch {
    log("info", "Could not read /etc/environment (may not exist or no permission)");
    return;
  }

  try {
    const content = await Bun.file(envFile).text();
    const updated = content.trim() + `\nPATH="${bunPath}:$PATH"\n`;
    await Bun.write(envFile, updated);
    log("success", `Added bun PATH to ${envFile}`);
  } catch {
    log("warning", `Could not write to ${envFile} (permission denied)`);
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
