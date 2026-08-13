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

    test("should use npm package", () => {
      expect((laneTool as any).NPM_PACKAGE).toBe("@ebowwa/lane");
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

  describe("npm package configuration", () => {
    test("should use @ebowwa/lane package", () => {
      expect((laneTool as any).NPM_PACKAGE).toBe("@ebowwa/lane");
    });
  });
});
