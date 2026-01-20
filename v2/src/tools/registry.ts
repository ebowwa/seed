/**
 * Tool Registry
 * Manages tool discovery, filtering, and installation
 */

import type { Environment } from "../env/detect.js";
import type { SetupOptions } from "../env/packages.js";
import { BunTool } from "./bun.js";
import { NodeAgentTool } from "./node-agent.js";
import { ClaudeTool } from "./claude.js";
import { GhTool } from "./gh.js";
import { DopplerTool } from "./doppler.js";

export interface Tool {
  name: string;
  description: string;
  installed: boolean;

  // Check if tool should be installed for this environment
  isApplicable(env: Environment): boolean | Promise<boolean>;

  // Install the tool
  install(env: Environment): Promise<void>;

  // Check if tool is already installed
  checkInstalled(env: Environment): boolean | Promise<boolean>;
}

export interface ToolInfo {
  name: string;
  description: string;
  installed: boolean;
}

export class ToolRegistry {
  private tools: Tool[];
  private env: Environment;
  private options: SetupOptions;

  constructor(env: Environment, options: SetupOptions = {}) {
    this.env = env;
    this.options = options;

    // Register all available tools
    this.tools = [
      new BunTool(),
      new NodeAgentTool(),
      new ClaudeTool(),
      new GhTool(),
      new DopplerTool(),
    ];
  }

  /**
   * Get all tools applicable to the current environment
   */
  async getToolsForEnvironment(): Promise<Tool[]> {
    const applicable: Tool[] = [];

    for (const tool of this.tools) {
      if (await tool.isApplicable(this.env)) {
        applicable.push(tool);
      }
    }

    return applicable;
  }

  /**
   * List all tools with their installation status
   */
  async listTools(): Promise<ToolInfo[]> {
    const info: ToolInfo[] = [];

    for (const tool of this.tools) {
      const installed = await tool.checkInstalled(this.env);
      info.push({
        name: tool.name,
        description: tool.description,
        installed,
      });
    }

    return info;
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: Tool): void {
    this.tools.push(tool);
  }
}
