"use strict";
// ============================================================================
// DaemonLayerAgentService - PM Daemon AI Brain
// ============================================================================
//
// PURPOSE: Manages persistent Claude Code sessions for the Project Manager daemon
//
// ARCHITECTURE:
//   ┌─────────────────────────────────────────────────────────────┐
//   │                    DaemonLayerAgentService                   │
//   │  ┌──────────────────────────────────────────────────────┐  │
//   │  │         PersistentClaudeSession                       │  │
//   │  │  • Long-running Claude Code process via doppler       │  │
//   │  │  • stdin/stdout communication pipe                    │  │
//   │  │  • Auto-restart on crash                              │  │
//   │  │  • Memory/context handled by Claude                  │  │
//   │  └──────────────────────────────────────────────────────┘  │
//   │                                                             │
//   │  • spawnWorker() - One-off Claude sessions                │
//   │  • spawnWorkers() - Parallel workers                      │
//   └─────────────────────────────────────────────────────────────┘
//
// INTEGRATION POINTS for @codespaces/tooling:
//   1. start() - Run tooling.sync() on startup to ensure repos are current
//   2. processMessage() - Check tooling.status() for context before processing
//   3. spawnWorker() - Validate tooling state before spawning workers
//   4. Add new methods: syncRepos(), validateRepos(), getRepoStatus()
//
// CONFIGURATION:
//   - dopplerProject: Doppler project name (default: "seed")
//   - dopplerConfig: Doppler config (default: "prd")
//   - cwd: Working directory for Claude sessions
//
// TODO: Add tooling integration
//   - import { ToolingService } from "@codespaces/tooling"
//   - Call tooling.sync() during start()
//   - Expose tooling status via API
//
// ============================================================================
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DaemonLayerAgentService = void 0;
var child_process_1 = require("child_process");
var path_1 = require("path");
var SPAWN_TIMEOUT_MS = 120000; // 2 minutes for spawned sessions
// ============================================================================
// PersistentClaudeSession
// ============================================================================
/**
 * Manages a single persistent Claude Code process with stdin/stdout communication
 *
 * This class maintains a long-running Claude Code session that:
 * - Survives multiple requests (memory/context preserved)
 * - Auto-restarts on crashes
 * - Communicates via stdin/stdout pipes
 * - Handles timeout and graceful shutdown
 */
var PersistentClaudeSession = /** @class */ (function () {
    function PersistentClaudeSession(config) {
        this.process = null;
        this.stdoutBuffer = "";
        this.isReady = false;
        this.isShutdown = false;
        this.pendingResolver = null;
        this.config = config;
    }
    /**
     * Start the persistent Claude Code process
     *
     * Spawns: doppler run --project <proj> --config <cfg> -- claude
     * - Uses doppler to inject secrets
     * - Pipes stdin/stdout/stderr
     * - Sets up auto-restart on crash
     */
    PersistentClaudeSession.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var supervisorPath, args;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (this.process) {
                            throw new Error("Persistent session already running");
                        }
                        console.log("[PmBrain] Starting persistent Claude Code session with rolling keys supervisor...");
                        supervisorPath = path_1.default.join(path_1.default.dirname(import.meta.url.replace("file://", "")), "..", "lib", "rolling-keys-supervisor.ts");
                        args = [
                            "run",
                            "--project",
                            this.config.dopplerProject,
                            "--config",
                            this.config.dopplerConfig,
                            "--",
                            "bun",
                            "run",
                            supervisorPath,
                        ];
                        this.process = (0, child_process_1.spawn)("doppler", args, {
                            cwd: this.config.cwd,
                            stdio: ["pipe", "pipe", "pipe"],
                        });
                        // Handle stdout - collect output until we have a complete response
                        (_a = this.process.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (data) {
                            _this.stdoutBuffer += data.toString();
                            // Check if we have a complete response (heuristic: empty line + output)
                            if (_this.pendingResolver && _this.isResponseComplete(_this.stdoutBuffer)) {
                                var response = _this.extractResponse(_this.stdoutBuffer);
                                _this.pendingResolver(response);
                                _this.pendingResolver = null;
                                _this.stdoutBuffer = "";
                            }
                        });
                        // Handle stderr (log it but don't crash)
                        (_b = this.process.stderr) === null || _b === void 0 ? void 0 : _b.on("data", function (data) {
                            console.error("[Claude]", data.toString());
                        });
                        // Handle process exit - auto-restart if it crashes
                        this.process.on("close", function (code) {
                            console.log("[PmBrain] Claude Code exited (code: ".concat(code, ")"));
                            if (!_this.isShutdown) {
                                console.log("[PmBrain] Restarting in 5 seconds...");
                                setTimeout(function () { return _this.start(); }, 5000);
                            }
                            _this.process = null;
                            _this.isReady = false;
                        });
                        // Handle process error
                        this.process.on("error", function (error) {
                            console.error("[PmBrain] Claude Code error:", error);
                        });
                        // Wait for process to be ready (2 second timeout or first stdout)
                        return [4 /*yield*/, new Promise(function (resolve) {
                                var _a, _b;
                                var timeout = setTimeout(function () {
                                    _this.isReady = true;
                                    resolve();
                                }, 2000);
                                (_b = (_a = _this.process) === null || _a === void 0 ? void 0 : _a.stdout) === null || _b === void 0 ? void 0 : _b.once("data", function () {
                                    clearTimeout(timeout);
                                    _this.isReady = true;
                                    resolve();
                                });
                            })];
                    case 1:
                        // Wait for process to be ready (2 second timeout or first stdout)
                        _c.sent();
                        console.log("[PmBrain] ✓ Claude Code session running");
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if response appears complete
     * Heuristic: empty line + substantial output
     */
    PersistentClaudeSession.prototype.isResponseComplete = function (output) {
        return output.includes("\n\n") && output.length > 50;
    };
    /**
     * Extract Claude's response from buffer
     * Removes ANSI escape codes for clean output
     */
    PersistentClaudeSession.prototype.extractResponse = function (buffer) {
        var ansiRegex = /\x1b\[[0-9;]*m/g;
        var cleaned = buffer.replace(ansiRegex, "");
        return cleaned.trim();
    };
    /**
     * Send a message to Claude and wait for response
     *
     * INTEGRATION POINT: Could inject tooling status here for context
     */
    PersistentClaudeSession.prototype.sendMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.process || !this.isReady) {
                    throw new Error("Claude Code not ready");
                }
                console.log("[PmBrain] \u2192 ".concat(message.substring(0, 100)).concat(message.length > 100 ? "..." : ""));
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var _a;
                        var timeout = setTimeout(function () {
                            // Timeout - return whatever we have
                            var response = _this.extractResponse(_this.stdoutBuffer);
                            _this.pendingResolver = null;
                            _this.stdoutBuffer = "";
                            resolve(response || "No response (timeout)");
                        }, 60000); // 60 second timeout
                        _this.pendingResolver = function (response) {
                            clearTimeout(timeout);
                            console.log("[PmBrain] \u2190 ".concat(response.substring(0, 100)).concat(response.length > 100 ? "..." : ""));
                            resolve(response);
                        };
                        // Write to stdin
                        (_a = _this.process) === null || _a === void 0 ? void 0 : _a.stdin.write(message + "\n");
                    })];
            });
        });
    };
    /**
     * Shutdown the persistent session
     * Attempts graceful SIGTERM, then SIGKILL after 5 seconds
     */
    PersistentClaudeSession.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.isShutdown = true;
                        if (!this.process) return [3 /*break*/, 2];
                        console.log("[PmBrain] Shutting down Claude Code...");
                        this.process.kill("SIGTERM");
                        // Wait up to 5 seconds for graceful shutdown
                        return [4 /*yield*/, new Promise(function (resolve) {
                                var _a;
                                var timeout = setTimeout(function () {
                                    var _a;
                                    (_a = _this.process) === null || _a === void 0 ? void 0 : _a.kill("SIGKILL");
                                    resolve();
                                }, 5000);
                                (_a = _this.process) === null || _a === void 0 ? void 0 : _a.once("close", function () {
                                    clearTimeout(timeout);
                                    resolve();
                                });
                            })];
                    case 1:
                        // Wait up to 5 seconds for graceful shutdown
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if process is running
     */
    PersistentClaudeSession.prototype.isRunning = function () {
        return this.process !== null && this.isReady;
    };
    return PersistentClaudeSession;
}());
// ============================================================================
// DaemonLayerAgentService
// ============================================================================
/**
 * Main service for managing PM daemon's AI brain
 *
 * RESPONSIBILITIES:
 * - Maintains persistent Claude Code session for context/memory
 * - Spawns one-off worker sessions for parallel tasks
 * - Processes incoming messages with monitor event context
 *
 * INTEGRATION: Add tooling methods here (syncRepos, getRepoStatus, etc.)
 */
var DaemonLayerAgentService = /** @class */ (function () {
    // TODO: Add tooling service
    // private tooling?: ToolingService;
    function DaemonLayerAgentService(config) {
        if (config === void 0) { config = {}; }
        this.persistentSession = null;
        this.isProcessing = false;
        this.config = {
            dopplerProject: config.dopplerProject || process.env.DOPPLER_PROJECT || "seed",
            dopplerConfig: config.dopplerConfig || process.env.DOPPLER_CONFIG || "prd",
            cwd: config.cwd || process.cwd(),
        };
    }
    /**
     * Start the PM brain with persistent Claude Code session
     *
     * INTEGRATION POINT: Call tooling.sync() here to ensure repos are current
     * TODO:
     *   - Initialize tooling service
     *   - Run await this.tooling.sync() on startup
     */
    DaemonLayerAgentService.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.persistentSession) {
                            console.warn("[PmBrain] Already started");
                            return [2 /*return*/];
                        }
                        // TODO: Initialize and sync tooling
                        // this.tooling = new ToolingService();
                        // await this.tooling.sync();
                        this.persistentSession = new PersistentClaudeSession({
                            dopplerProject: this.config.dopplerProject,
                            dopplerConfig: this.config.dopplerConfig,
                            cwd: this.config.cwd,
                        });
                        return [4 /*yield*/, this.persistentSession.start()];
                    case 1:
                        _a.sent();
                        console.log("[PmBrain] ✓ PM brain ready");
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stop the PM brain
     */
    DaemonLayerAgentService.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.persistentSession) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.persistentSession.shutdown()];
                    case 1:
                        _a.sent();
                        this.persistentSession = null;
                        console.log("[PmBrain] PM brain stopped");
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if brain is running
     */
    DaemonLayerAgentService.prototype.isRunning = function () {
        var _a, _b;
        return (_b = (_a = this.persistentSession) === null || _a === void 0 ? void 0 : _a.isRunning()) !== null && _b !== void 0 ? _b : false;
    };
    /**
     * Process a message through the persistent session
     * Claude Code handles all memory and context
     *
     * INTEGRATION POINT: Could inject tooling status into context
     * TODO:
     *   - Check tooling.status() for repo state
     *   - Inject dirty/uncommitted states into context
     */
    DaemonLayerAgentService.prototype.processMessage = function (message, context) {
        return __awaiter(this, void 0, void 0, function () {
            var fullMessage, responseText, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.persistentSession) {
                            throw new Error("PM brain not started. Call start() first.");
                        }
                        if (this.isProcessing) {
                            return [2 /*return*/, {
                                    text: "Busy processing previous message. Try again in a moment.",
                                }];
                        }
                        this.isProcessing = true;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        fullMessage = message;
                        if (context === null || context === void 0 ? void 0 : context.events) {
                            fullMessage = this.injectContext(message, context.events);
                        }
                        return [4 /*yield*/, this.persistentSession.sendMessage(fullMessage)];
                    case 2:
                        responseText = _a.sent();
                        return [2 /*return*/, {
                                text: responseText,
                            }];
                    case 3:
                        error_1 = _a.sent();
                        console.error("[PmBrain] Error:", error_1);
                        return [2 /*return*/, {
                                text: "Error: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                            }];
                    case 4:
                        this.isProcessing = false;
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Inject context into message (for monitor events)
     */
    DaemonLayerAgentService.prototype.injectContext = function (message, events) {
        if (events.length === 0) {
            return message;
        }
        var parts = [];
        // Add events if provided
        parts.push("\n**Recent Events:**");
        for (var _i = 0, _a = events.slice(-5); _i < _a.length; _i++) {
            var event_1 = _a[_i];
            var time = new Date(event_1.timestamp).toLocaleTimeString();
            parts.push("- [".concat(time, "] ").concat(event_1.type, " on ").concat(event_1.node_id));
        }
        parts.push("\n**Message:**");
        parts.push(message);
        return parts.join("\n");
    };
    /**
     * Spawn a fresh Claude Code session for a one-off task
     * Returns response without affecting persistent session
     *
     * INTEGRATION POINT: Validate tooling state before spawning
     * TODO: Check tooling.validate() before running workers
     */
    DaemonLayerAgentService.prototype.spawnWorker = function (prompt) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                console.log("[PmBrain] Spawning worker Claude...");
                // TODO: Validate environment before spawning
                // const isValid = await this.tooling?.validate();
                // if (!isValid.valid) {
                //   throw new Error(`Environment invalid: ${isValid.errors.join(', ')}`);
                // }
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var _a, _b;
                        // Get the path to the rolling-keys-supervisor.ts
                        var supervisorPath = path_1.default.join(path_1.default.dirname(import.meta.url.replace("file://", "")), "..", "lib", "rolling-keys-supervisor.ts");
                        // Use rolling keys supervisor for one-shot Claude spawn
                        var args = [
                            "run",
                            "--project",
                            _this.config.dopplerProject,
                            "--config",
                            _this.config.dopplerConfig,
                            "--",
                            "bun",
                            "run",
                            supervisorPath,
                            "-p",
                            prompt,
                        ];
                        var claude = (0, child_process_1.spawn)("doppler", args, {
                            cwd: _this.config.cwd,
                        });
                        var stdout = "";
                        var stderr = "";
                        (_a = claude.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (data) {
                            stdout += data.toString();
                        });
                        (_b = claude.stderr) === null || _b === void 0 ? void 0 : _b.on("data", function (data) {
                            stderr += data.toString();
                        });
                        claude.on("close", function (code) {
                            if (code === 0) {
                                var ansiRegex = /\x1b\[[0-9;]*m/g;
                                var cleaned = stdout.replace(ansiRegex, "").trim();
                                resolve(cleaned);
                            }
                            else {
                                reject(new Error("Worker exited with code ".concat(code, ": ").concat(stderr)));
                            }
                        });
                        claude.on("error", function (error) {
                            reject(new Error("Failed to spawn worker: ".concat(error.message)));
                        });
                        setTimeout(function () {
                            claude.kill("SIGTERM");
                            reject(new Error("Worker timed out"));
                        }, SPAWN_TIMEOUT_MS);
                    })];
            });
        });
    };
    /**
     * Spawn multiple workers in parallel
     */
    DaemonLayerAgentService.prototype.spawnWorkers = function (prompts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                console.log("[PmBrain] Spawning ".concat(prompts.length, " parallel workers..."));
                return [2 /*return*/, Promise.all(prompts.map(function (p) { return _this.spawnWorker(p); }))];
            });
        });
    };
    /**
     * Get session stats
     *
     * TODO: Add tooling status to stats
     * return {
     *   running: this.isRunning(),
     *   repos: await this.tooling?.getStatus(),
     * };
     */
    DaemonLayerAgentService.prototype.getSessionStats = function () {
        return {
            running: this.isRunning(),
        };
    };
    return DaemonLayerAgentService;
}());
exports.DaemonLayerAgentService = DaemonLayerAgentService;
