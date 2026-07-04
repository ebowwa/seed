#!/usr/bin/env bun
"use strict";
/**
 * Seed Setup v2 - Main Entry Point
 * Fast, reliable environment setup powered by Bun
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
// TINKER: Import path resolution
// Originally used ".js" extensions (ESM standard) → Bun couldn't find modules
// Then tried ".ts" extensions → Still didn't work
// Solution: Use no extensions, Bun resolves them correctly
var detect_1 = require("./env/detect");
var packages_1 = require("./env/packages");
var registry_1 = require("./tools/registry");
var check_1 = require("./health/check");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, startTime, options, positional, i, arg, env, command, health_1, registry_2, tools, _i, tools_1, tool, status_1, registry, toolsToInstall, timings, curlTools, bunTool, bunDependentTools, aptTools, runToolsParallel, runToolsSerial, phaseStart, results, phaseEnd, phaseStart, results, phaseEnd, phaseStart, results, phaseEnd, phaseStart, results, phaseEnd, health, endTime, totalMs, issues, _a, issues_1, issue, timingsTable;
        var _this = this;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    args = process.argv.slice(2);
                    startTime = performance.now();
                    options = {};
                    positional = [];
                    for (i = 0; i < args.length; i++) {
                        arg = args[i];
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
                                options.aiAssistant = args[++i];
                                break;
                            case "--help":
                            case "-h":
                                showHelp();
                                process.exit(0);
                            default:
                                if (arg.startsWith("-")) {
                                    console.error("Unknown option: ".concat(arg));
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
                    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551  Seed Setup v2 - Fast Environment Bootstrap               \u2551\n\u2551  Powered by Bun \u2022 TypeScript \u2022 Zero Runtime Deps          \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n");
                    return [4 /*yield*/, (0, detect_1.detectEnvironment)()];
                case 1:
                    env = _d.sent();
                    log("info", "Environment: ".concat(env.type));
                    log("info", "OS: ".concat(env.os, " ").concat(env.arch));
                    log("info", "Platform: ".concat(env.platform));
                    if (options.verbose) {
                        log("debug", "Environment details:", env);
                    }
                    command = positional[0];
                    if (!(command === "health")) return [3 /*break*/, 3];
                    log("info", "Running health check...");
                    return [4 /*yield*/, (0, check_1.healthCheck)(env)];
                case 2:
                    health_1 = _d.sent();
                    console.log(JSON.stringify(health_1, null, 2));
                    return [2 /*return*/];
                case 3:
                    if (!(command === "list")) return [3 /*break*/, 5];
                    log("info", "Available tools:");
                    registry_2 = new registry_1.ToolRegistry(env);
                    return [4 /*yield*/, registry_2.listTools()];
                case 4:
                    tools = _d.sent();
                    for (_i = 0, tools_1 = tools; _i < tools_1.length; _i++) {
                        tool = tools_1[_i];
                        status_1 = tool.installed ? "✓" : "○";
                        console.log("  ".concat(status_1, " ").concat(tool.name, " - ").concat(tool.description));
                    }
                    return [2 /*return*/];
                case 5:
                    // Default: run setup
                    log("info", "Starting setup...");
                    // Install package manager if needed
                    return [4 /*yield*/, (0, packages_1.installPackages)(env, options)];
                case 6:
                    // Install package manager if needed
                    _d.sent();
                    registry = new registry_1.ToolRegistry(env, options);
                    return [4 /*yield*/, registry.getToolsForEnvironment()];
                case 7:
                    toolsToInstall = _d.sent();
                    if ((_b = options.only) === null || _b === void 0 ? void 0 : _b.length) {
                        toolsToInstall = toolsToInstall.filter(function (t) {
                            return options.only.includes(t.name);
                        });
                    }
                    if ((_c = options.skip) === null || _c === void 0 ? void 0 : _c.length) {
                        toolsToInstall = toolsToInstall.filter(function (t) { return !options.skip.includes(t.name); });
                    }
                    // Install tools with timing
                    // TINKER: Added performance tracking to measure each tool install time
                    log("info", "Installing ".concat(toolsToInstall.length, " tools..."));
                    timings = [];
                    curlTools = toolsToInstall.filter(function (t) {
                        return ["claude", "doppler"].includes(t.name);
                    });
                    bunTool = toolsToInstall.find(function (t) { return t.name === "bun"; });
                    bunDependentTools = toolsToInstall.filter(function (t) {
                        return ["lane", "ralph"].includes(t.name);
                    });
                    aptTools = toolsToInstall.filter(function (t) {
                        return ["node", "tmux", "gh"].includes(t.name);
                    });
                    runToolsParallel = function (tools) { return __awaiter(_this, void 0, void 0, function () {
                        var toolsToInstall, alreadyInstalled, _i, tools_2, tool, installedResults, _a, toolsToInstall_1, tool, startTimes, installPromises, results, _b, results_1, result;
                        var _this = this;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    if (tools.length === 0)
                                        return [2 /*return*/, []];
                                    toolsToInstall = [];
                                    alreadyInstalled = [];
                                    _i = 0, tools_2 = tools;
                                    _c.label = 1;
                                case 1:
                                    if (!(_i < tools_2.length)) return [3 /*break*/, 4];
                                    tool = tools_2[_i];
                                    return [4 /*yield*/, tool.checkInstalled(env)];
                                case 2:
                                    if (_c.sent()) {
                                        log("info", "\u2713 ".concat(tool.name, " already installed, skipping"));
                                        alreadyInstalled.push(tool);
                                    }
                                    else {
                                        toolsToInstall.push(tool);
                                    }
                                    _c.label = 3;
                                case 3:
                                    _i++;
                                    return [3 /*break*/, 1];
                                case 4:
                                    installedResults = alreadyInstalled.map(function (t) { return ({ name: t.name, ms: 0, status: "⊘" }); });
                                    if (toolsToInstall.length === 0)
                                        return [2 /*return*/, installedResults];
                                    if (options.dryRun) {
                                        for (_a = 0, toolsToInstall_1 = toolsToInstall; _a < toolsToInstall_1.length; _a++) {
                                            tool = toolsToInstall_1[_a];
                                            log("dry-run", "Would install: ".concat(tool.name));
                                        }
                                        return [2 /*return*/, __spreadArray(__spreadArray([], installedResults, true), toolsToInstall.map(function (t) { return ({ name: t.name, ms: 0, status: "○" }); }), true)];
                                    }
                                    startTimes = new Map(toolsToInstall.map(function (t) { return [t.name, performance.now()]; }));
                                    installPromises = toolsToInstall.map(function (tool) { return __awaiter(_this, void 0, void 0, function () {
                                        var toolEnd, toolMs, error_1, toolEnd, toolMs, result;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0:
                                                    _a.trys.push([0, 2, , 3]);
                                                    log("info", "Installing ".concat(tool.name, "..."));
                                                    return [4 /*yield*/, tool.install(env)];
                                                case 1:
                                                    _a.sent();
                                                    toolEnd = performance.now();
                                                    toolMs = Math.round(toolEnd - startTimes.get(tool.name));
                                                    return [2 /*return*/, { name: tool.name, ms: toolMs, status: "✓" }];
                                                case 2:
                                                    error_1 = _a.sent();
                                                    toolEnd = performance.now();
                                                    toolMs = Math.round(toolEnd - startTimes.get(tool.name));
                                                    result = { name: tool.name, ms: toolMs, status: "✗" };
                                                    log("error", "".concat(tool.name, " failed: ").concat(error_1));
                                                    if (!options.force) {
                                                        throw error_1;
                                                    }
                                                    return [2 /*return*/, result];
                                                case 3: return [2 /*return*/];
                                            }
                                        });
                                    }); });
                                    return [4 /*yield*/, Promise.all(installPromises)];
                                case 5:
                                    results = _c.sent();
                                    for (_b = 0, results_1 = results; _b < results_1.length; _b++) {
                                        result = results_1[_b];
                                        if (result.status === "✓") {
                                            log("success", "".concat(result.name, " installed (").concat(result.ms, "ms)"));
                                        }
                                    }
                                    return [2 /*return*/, __spreadArray(__spreadArray([], installedResults, true), results, true)];
                            }
                        });
                    }); };
                    runToolsSerial = function (tools) { return __awaiter(_this, void 0, void 0, function () {
                        var results, _i, tools_3, tool, toolStart, toolEnd, toolMs, error_2, toolEnd, toolMs;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    results = [];
                                    _i = 0, tools_3 = tools;
                                    _a.label = 1;
                                case 1:
                                    if (!(_i < tools_3.length)) return [3 /*break*/, 7];
                                    tool = tools_3[_i];
                                    return [4 /*yield*/, tool.checkInstalled(env)];
                                case 2:
                                    // Skip if already installed
                                    if (_a.sent()) {
                                        log("info", "\u2713 ".concat(tool.name, " already installed, skipping"));
                                        results.push({ name: tool.name, ms: 0, status: "⊘" });
                                        return [3 /*break*/, 6];
                                    }
                                    if (options.dryRun) {
                                        log("dry-run", "Would install: ".concat(tool.name));
                                        results.push({ name: tool.name, ms: 0, status: "○" });
                                        return [3 /*break*/, 6];
                                    }
                                    toolStart = performance.now();
                                    _a.label = 3;
                                case 3:
                                    _a.trys.push([3, 5, , 6]);
                                    log("info", "Installing ".concat(tool.name, "..."));
                                    return [4 /*yield*/, tool.install(env)];
                                case 4:
                                    _a.sent();
                                    toolEnd = performance.now();
                                    toolMs = Math.round(toolEnd - toolStart);
                                    results.push({ name: tool.name, ms: toolMs, status: "✓" });
                                    log("success", "".concat(tool.name, " installed (").concat(toolMs, "ms)"));
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_2 = _a.sent();
                                    toolEnd = performance.now();
                                    toolMs = Math.round(toolEnd - toolStart);
                                    results.push({ name: tool.name, ms: toolMs, status: "✗" });
                                    log("error", "".concat(tool.name, " failed: ").concat(error_2));
                                    if (!options.force) {
                                        throw error_2;
                                    }
                                    return [3 /*break*/, 6];
                                case 6:
                                    _i++;
                                    return [3 /*break*/, 1];
                                case 7: return [2 /*return*/, results];
                            }
                        });
                    }); };
                    if (!(curlTools.length > 0)) return [3 /*break*/, 9];
                    phaseStart = performance.now();
                    log("info", "Phase 1: Installing ".concat(curlTools.length, " curl-based tools in parallel..."));
                    return [4 /*yield*/, runToolsParallel(curlTools)];
                case 8:
                    results = _d.sent();
                    timings.push.apply(timings, results);
                    phaseEnd = performance.now();
                    log("success", "Phase 1 complete (".concat(Math.round(phaseEnd - phaseStart), "ms)"));
                    _d.label = 9;
                case 9:
                    if (!bunTool) return [3 /*break*/, 11];
                    phaseStart = performance.now();
                    log("info", "Phase 2: Verifying bun...");
                    return [4 /*yield*/, runToolsSerial([bunTool])];
                case 10:
                    results = _d.sent();
                    timings.push.apply(timings, results);
                    phaseEnd = performance.now();
                    log("success", "Phase 2 complete (".concat(Math.round(phaseEnd - phaseStart), "ms)"));
                    _d.label = 11;
                case 11:
                    if (!(bunDependentTools.length > 0)) return [3 /*break*/, 13];
                    phaseStart = performance.now();
                    log("info", "Phase 3: Installing ".concat(bunDependentTools.length, " bun-dependent tools in parallel..."));
                    return [4 /*yield*/, runToolsParallel(bunDependentTools)];
                case 12:
                    results = _d.sent();
                    timings.push.apply(timings, results);
                    phaseEnd = performance.now();
                    log("success", "Phase 3 complete (".concat(Math.round(phaseEnd - phaseStart), "ms)"));
                    _d.label = 13;
                case 13:
                    if (!(aptTools.length > 0)) return [3 /*break*/, 15];
                    phaseStart = performance.now();
                    log("info", "Phase 4: Installing ".concat(aptTools.length, " apt-based tools serially..."));
                    return [4 /*yield*/, runToolsSerial(aptTools)];
                case 14:
                    results = _d.sent();
                    timings.push.apply(timings, results);
                    phaseEnd = performance.now();
                    log("success", "Phase 4 complete (".concat(Math.round(phaseEnd - phaseStart), "ms)"));
                    _d.label = 15;
                case 15:
                    // Run health check
                    log("info", "Verifying installation...");
                    return [4 /*yield*/, (0, check_1.healthCheck)(env)];
                case 16:
                    health = _d.sent();
                    // Configure PATH for bun
                    return [4 /*yield*/, configureBunPath()];
                case 17:
                    // Configure PATH for bun
                    _d.sent();
                    endTime = performance.now();
                    totalMs = Math.round(endTime - startTime);
                    issues = health.issues.filter(function (i) { return i.severity === "error"; });
                    if (issues.length > 0) {
                        log("warning", "Setup completed with issues:");
                        for (_a = 0, issues_1 = issues; _a < issues_1.length; _a++) {
                            issue = issues_1[_a];
                            console.log("  - ".concat(issue.message));
                        }
                    }
                    else {
                        log("success", "Setup complete! 🎉");
                    }
                    timingsTable = timings
                        .map(function (t) { return "  ".concat(t.status, " ").concat(t.name.padEnd(15), " ").concat(t.ms.toString().padStart(5), "ms"); })
                        .join("\n");
                    // Show summary
                    console.log("\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n  Environment: ".concat(env.type, "\n  Tools Installed: ").concat(health.tools.filter(function (t) { return t.installed; }).length, "/").concat(health.tools.length, "\n  Health: ").concat(issues.length === 0 ? "✓ All good" : "".concat(issues.length, " issues"), "\n  Total Time: ").concat(totalMs, "ms\n\n").concat(timingsTable, "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"));
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Logging Utilities
// ============================================================================
var colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
};
function log(level, message) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    var timestamp = new Date().toLocaleTimeString();
    var color = {
        info: colors.blue,
        success: colors.green,
        warning: colors.yellow,
        error: colors.red,
        debug: colors.gray,
        "dry-run": colors.gray,
    }[level] || colors.reset;
    var prefix = {
        info: "ℹ",
        success: "✓",
        warning: "⚠",
        error: "✗",
        debug: "◦",
        "dry-run": "[dry-run]",
    }[level];
    console.log.apply(console, __spreadArray(["".concat(color).concat(prefix, " ").concat(timestamp, " ").concat(message).concat(colors.reset)], args, false));
}
function configureBunPath() {
    return __awaiter(this, void 0, void 0, function () {
        var bunPath, pathLine, shellConfigs, currentShell, priorityConfigs, allFallbackConfigs, _i, _a, configs, _b, configs_1, config, allConfigs, envFile, configured, content, _c, content, updated, _d, _e, allConfigs_1, configPath, existsProc, exitCode, content, updated, _f;
        var _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    bunPath = "".concat(process.env.HOME, "/.bun/bin");
                    pathLine = "export PATH=\"".concat(bunPath, ":$PATH\"");
                    shellConfigs = {
                        zsh: ["".concat(process.env.HOME, "/.zshrc")],
                        bash: [
                            "".concat(process.env.HOME, "/.bashrc"),
                            "".concat(process.env.HOME, "/.bash_profile"),
                        ],
                        sh: ["".concat(process.env.HOME, "/.profile")],
                    };
                    currentShell = ((_g = process.env.SHELL) === null || _g === void 0 ? void 0 : _g.split("/").pop()) || "bash";
                    priorityConfigs = shellConfigs[currentShell] || shellConfigs.bash;
                    allFallbackConfigs = [];
                    for (_i = 0, _a = Object.values(shellConfigs); _i < _a.length; _i++) {
                        configs = _a[_i];
                        for (_b = 0, configs_1 = configs; _b < configs_1.length; _b++) {
                            config = configs_1[_b];
                            if (!priorityConfigs.includes(config)) {
                                allFallbackConfigs.push(config);
                            }
                        }
                    }
                    allConfigs = __spreadArray(__spreadArray([], priorityConfigs, true), allFallbackConfigs, true);
                    envFile = "/etc/environment";
                    configured = false;
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Bun.file(envFile).text()];
                case 2:
                    content = _h.sent();
                    if (content.includes(bunPath)) {
                        log("info", "Bun PATH already configured in /etc/environment");
                        return [2 /*return*/];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    _c = _h.sent();
                    return [3 /*break*/, 4];
                case 4:
                    _h.trys.push([4, 7, , 8]);
                    return [4 /*yield*/, Bun.file(envFile).text()];
                case 5:
                    content = _h.sent();
                    updated = content.trim() + "\nPATH=\"".concat(bunPath, ":$PATH\"\n");
                    return [4 /*yield*/, Bun.write(envFile, updated)];
                case 6:
                    _h.sent();
                    log("success", "Added bun PATH to ".concat(envFile));
                    configured = true;
                    return [3 /*break*/, 8];
                case 7:
                    _d = _h.sent();
                    return [3 /*break*/, 8];
                case 8:
                    if (!!configured) return [3 /*break*/, 18];
                    _e = 0, allConfigs_1 = allConfigs;
                    _h.label = 9;
                case 9:
                    if (!(_e < allConfigs_1.length)) return [3 /*break*/, 17];
                    configPath = allConfigs_1[_e];
                    _h.label = 10;
                case 10:
                    _h.trys.push([10, 15, , 16]);
                    existsProc = Bun.spawn(["test", "-f", configPath], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, existsProc.exited];
                case 11:
                    exitCode = _h.sent();
                    content = "";
                    if (!(exitCode === 0)) return [3 /*break*/, 13];
                    return [4 /*yield*/, Bun.file(configPath).text()];
                case 12:
                    content = _h.sent();
                    // Check if already configured
                    if (content.includes(bunPath)) {
                        log("info", "Bun PATH already configured in ".concat(configPath));
                        return [2 /*return*/];
                    }
                    _h.label = 13;
                case 13:
                    updated = content.trim() + "\n".concat(pathLine, "\n");
                    return [4 /*yield*/, Bun.write(configPath, updated)];
                case 14:
                    _h.sent();
                    log("success", "Added bun PATH to ".concat(configPath));
                    return [2 /*return*/];
                case 15:
                    _f = _h.sent();
                    // Try next config file
                    return [3 /*break*/, 16];
                case 16:
                    _e++;
                    return [3 /*break*/, 9];
                case 17:
                    log("warning", "Could not configure bun PATH in any shell config");
                    log("info", "Add this to your shell config: export PATH=\"".concat(bunPath, ":$PATH\""));
                    _h.label = 18;
                case 18: return [2 /*return*/];
            }
        });
    });
}
function showHelp() {
    console.log("\nSeed Setup v2 - Fast Environment Bootstrap\n\nUSAGE:\n  setup [OPTIONS] [COMMAND]\n\nCOMMANDS:\n  (none)              Run full setup\n  health              Check system health and tool status\n  list                List available tools\n\nOPTIONS:\n  -f, --force         Continue on errors\n  -v, --verbose       Enable verbose logging\n  --dry-run           Show what would be done without doing it\n  --skip <tool>       Skip installing a specific tool\n  --only <tool>       Only install specific tools\n  --ai <assistant>    Set AI assistant (claude, codex, zai)\n  -h, --help          Show this help message\n\nEXAMPLES:\n  setup                     # Run full setup\n  setup --only bun node     # Only install Bun and Node\n  setup --skip docker       # Skip Docker installation\n  setup health              # Check system health\n  setup -v --dry-run        # Preview setup in verbose mode\n\nENVIRONMENT VARIABLES:\n  NONINTERACTIVE=1          Run without prompts\n  SEED_VERBOSE=1            Enable debug logging\n  CI=1                      Enable CI mode\n");
}
// ============================================================================
// Bootstrap
// ============================================================================
main().catch(function (error) {
    log("error", "Setup failed:", error);
    process.exit(1);
});
