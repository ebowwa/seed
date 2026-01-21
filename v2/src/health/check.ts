/**
 * Health Check System
 * Verifies installation status and system health
 */

import type { Environment } from "../env/detect";
import { ToolRegistry } from "../tools/registry";

export interface HealthResult {
  status: "healthy" | "warning" | "error";
  environment: EnvironmentInfo;
  tools: ToolHealth[];
  issues: HealthIssue[];
}

export interface EnvironmentInfo {
  type: string;
  os: string;
  arch: string;
  platform: string;
  isRoot: boolean;
  hasSudo: boolean;
  hasDocker: boolean;
}

export interface ToolHealth {
  name: string;
  description: string;
  installed: boolean;
  version?: string;
  path?: string;
}

export interface HealthIssue {
  severity: "error" | "warning" | "info";
  message: string;
  tool?: string;
}

/**
 * Run health check on the system
 */
export async function healthCheck(env: Environment): Promise<HealthResult> {
  const issues: HealthIssue[] = [];
  const registry = new ToolRegistry(env);
  const toolsList = await registry.listTools();

  // Check each tool
  const tools: ToolHealth[] = [];

  for (const tool of toolsList) {
    const health = await checkToolHealth(tool.name, env);
    tools.push(health);

    if (!health.installed) {
      issues.push({
        severity: "warning",
        message: `${tool.name} is not installed`,
        tool: tool.name,
      });
    }
  }

  // Check environment
  const envInfo: EnvironmentInfo = {
    type: env.type,
    os: env.os,
    arch: env.arch,
    platform: env.platform,
    isRoot: env.isRoot,
    hasSudo: env.hasSudo,
    hasDocker: env.hasDocker,
  };

  // Determine overall status
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  let status: "healthy" | "warning" | "error" = "healthy";
  if (errors.length > 0) {
    status = "error";
  } else if (warnings.length > 0) {
    status = "warning";
  }

  return {
    status,
    environment: envInfo,
    tools,
    issues,
  };
}

/**
 * Check health of a specific tool
 */
async function checkToolHealth(
  name: string,
  env: Environment
): Promise<ToolHealth> {
  // Check if command exists
  const proc = Bun.spawn(["which", name], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return {
      name,
      description: getToolDescription(name),
      installed: false,
    };
  }

  // Get version
  const versionProc = Bun.spawn([name, "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const versionOutput = await new Response(versionProc.stdout).text();
  const version = versionOutput.trim().split("\n")[0];

  // Get path
  const pathProc = Bun.spawn(["which", name], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const pathOutput = await new Response(pathProc.stdout).text();
  const path = pathOutput.trim();

  return {
    name,
    description: getToolDescription(name),
    installed: true,
    version,
    path,
  };
}

/**
 * Get tool description
 */
function getToolDescription(name: string): string {
  const descriptions: Record<string, string> = {
    bun: "Fast JavaScript runtime and package manager",
    "node-agent": "Ralph Loop orchestration API server",
    claude: "Claude Code CLI - AI-powered development assistant",
    gh: "GitHub CLI - Official GitHub command-line tool",
    doppler: "Doppler CLI - Secrets management",
  };

  return descriptions[name] || "Unknown tool";
}
