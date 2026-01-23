#!/usr/bin/env bun
/**
 * Lane Tool Test
 * Tests the LaneTool class functionality
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { LaneTool } from "../v2/src/tools/lane";
import type { Environment } from "../v2/src/env/detect";

describe("LaneTool", () => {
  let laneTool: LaneTool;
  let mockEnv: Environment;

  beforeEach(() => {
    laneTool = new LaneTool();

    // Mock environment for testing
    mockEnv = {
      os: "linux",
      arch: "x64",
      platform: "linux",
      type: "vps",
      hasSudo: true,
      isRoot: true,
      hasDocker: false,
      homeDir: "/tmp/test-home",
      cacheDir: "/tmp/test-home/.cache",
      configDir: "/tmp/test-home/.config",
      binDir: "/usr/local/bin",
      ci: null,
      isCodespaces: false,
      isContainer: false,
      isVPS: true,
      vpsProvider: "hetzner",
    };
  });

  afterEach(() => {
    // Cleanup test artifacts
  });

  describe("properties", () => {
    test("should have correct name", () => {
      expect(laneTool.name).toBe("lane");
    });

    test("should have description", () => {
      expect(laneTool.description).toBe(
        "Lane CLI - Git worktree alternative for parallel development"
      );
    });

    test("should have correct repo URL", () => {
      expect((laneTool as any).REPO_URL).toBe("https://github.com/ebowwa/lane.git");
    });

    test("should target bun-migration branch", () => {
      expect((laneTool as any).BRANCH).toBe("bun-migration");
    });
  });

  describe("isApplicable", () => {
    test("should be applicable for VPS environments", async () => {
      mockEnv.type = "vps";
      expect(await laneTool.isApplicable(mockEnv)).toBe(true);
    });

    test("should be applicable for local environments", async () => {
      mockEnv.type = "local";
      expect(await laneTool.isApplicable(mockEnv)).toBe(true);
    });

    test("should be applicable for codespaces", async () => {
      mockEnv.type = "codespaces";
      expect(await laneTool.isApplicable(mockEnv)).toBe(true);
    });

    test("should NOT be applicable for CI environments", async () => {
      mockEnv.type = "ci";
      expect(await laneTool.isApplicable(mockEnv)).toBe(false);
    });
  });

  describe("checkInstalled", () => {
    test("should return true when lane command exists", async () => {
      // Mock commandExists to return true
      laneTool.commandExists = async () => true;
      expect(await laneTool.checkInstalled(mockEnv)).toBe(true);
    });

    test("should return false when lane command does not exist", async () => {
      // Mock commandExists to return false
      laneTool.commandExists = async () => false;
      expect(await laneTool.checkInstalled(mockEnv)).toBe(false);
    });
  });

  describe("install", () => {
    test("should clone repo to ~/lane", async () => {
      const cloneDir = `${mockEnv.homeDir}/lane`;

      // Mock the exec method
      let capturedCmd: string[] | null = null;
      laneTool.exec = async (cmd: string[]) => {
        capturedCmd = cmd;
        return { stdout: "", stderr: "", exitCode: 0 };
      };

      // Mock Bun.spawn
      const originalSpawn = Bun.spawn;
      let spawnArgs: any[] = [];
      Bun.spawn = function (args: any) {
        spawnArgs.push(args);
        return originalSpawn(args);
      };

      try {
        await laneTool.install(mockEnv);

        // Verify git clone command
        expect(capturedCmd).toContain("git");
        expect(capturedCmd).toContain("clone");
        expect(capturedCmd).toContain("-b");
        expect(capturedCmd).toContain("bun-migration");
        expect(capturedCmd).toContain((laneTool as any).REPO_URL);
        expect(capturedCmd).toContain(cloneDir);
      } finally {
        Bun.spawn = originalSpawn;
      }
    });

    test("should use correct branch name", async () => {
      expect((laneTool as any).BRANCH).toBe("bun-migration");
    });
  });

  describe("repository configuration", () => {
    test("should use ebowwa/lane repo", () => {
      expect((laneTool as any).REPO_URL).toBe("https://github.com/ebowwa/lane.git");
    });

    test("should clone to home directory", () => {
      expect((laneTool as any).CLONE_DIR).toBe("~/lane");
    });
  });
});
