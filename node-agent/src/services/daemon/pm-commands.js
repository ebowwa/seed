"use strict";
// PM Commands Service
// Slash command fallback router - bypasses LLM for fast, deterministic responses
// Commands: /status, /loops, /start, /stop, /logs, /lanes, /health
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
exports.PmCommandsService = void 0;
var LOCALHOST = "127.0.0.1";
var API_PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);
var API_TIMEOUT_MS = 10000; // 10 seconds
var PmCommandsService = /** @class */ (function () {
    function PmCommandsService() {
        this.handlers = new Map();
        this.registerHandlers();
    }
    /**
     * Register all command handlers
     */
    PmCommandsService.prototype.registerHandlers = function () {
        this.handlers.set("status", {
            command: "status",
            description: "Show node status",
            handler: this.handleStatus.bind(this),
        });
        this.handlers.set("loops", {
            command: "loops",
            description: "List all Ralph loops",
            handler: this.handleLoops.bind(this),
        });
        this.handlers.set("start", {
            command: "start",
            description: "Start a Ralph loop",
            handler: this.handleStart.bind(this),
        });
        this.handlers.set("stop", {
            command: "stop",
            description: "Stop a Ralph loop",
            handler: this.handleStop.bind(this),
        });
        this.handlers.set("logs", {
            command: "logs",
            description: "Get recent logs for a Ralph loop",
            handler: this.handleLogs.bind(this),
        });
        this.handlers.set("lanes", {
            command: "lanes",
            description: "List worktrees",
            handler: this.handleLanes.bind(this),
        });
        this.handlers.set("health", {
            command: "health",
            description: "Show PM daemon health status",
            handler: this.handleHealth.bind(this),
        });
        this.handlers.set("help", {
            command: "help",
            description: "Show available commands",
            handler: this.handleHelp.bind(this),
        });
        this.handlers.set("chat", {
            command: "chat",
            description: "Non-command messages (forward to PM brain)",
            handler: this.handleChat.bind(this),
        });
    };
    /**
     * Execute a command
     */
    PmCommandsService.prototype.executeCommand = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var handler, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        handler = this.handlers.get(command.command);
                        if (!handler) {
                            return [2 /*return*/, {
                                    text: "Unknown command: /".concat(command.command, "\n\nType /help for available commands."),
                                }];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, handler.handler(command)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_1 = _a.sent();
                        console.error("[PmCommands] Error executing /".concat(command.command, ":"), error_1);
                        return [2 /*return*/, {
                                text: "Error executing /".concat(command.command, ": ").concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all registered commands
     */
    PmCommandsService.prototype.getCommands = function () {
        return Array.from(this.handlers.values());
    };
    // ========================================================================
    // Command Handlers
    // ========================================================================
    /**
     * /status - Show node status
     */
    PmCommandsService.prototype.handleStatus = function (_command) {
        return __awaiter(this, void 0, void 0, function () {
            var status, lines, _i, _a, loop;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.fetchLocalStatus()];
                    case 1:
                        status = _b.sent();
                        if (!status) {
                            return [2 /*return*/, { text: "Failed to fetch node status" }];
                        }
                        lines = [
                            "*".concat(status.node_id, "*"),
                            "",
                            "Host: ".concat(status.hostname),
                            "Tailscale IP: ".concat(status.tailscale_ip),
                            "",
                            "*Capacity:*",
                            "  CPU: ".concat(status.capacity.cpu_percent, "%"),
                            "  Memory: ".concat(status.capacity.memory_percent, "%"),
                            "  Disk: ".concat(status.capacity.disk_percent, "%"),
                            "",
                            "*Sessions:*",
                            "  SSH: ".concat(status.sessions.ssh, " | tmux: ").concat(status.sessions.tmux, " | Claude: ").concat(status.sessions.claude_code),
                            "",
                            "*Worktrees:* ".concat(status.worktrees.length),
                            "*Ralph Loops:* ".concat(status.ralph_loops.length),
                        ];
                        if (status.ralph_loops.length > 0) {
                            lines.push("");
                            for (_i = 0, _a = status.ralph_loops; _i < _a.length; _i++) {
                                loop = _a[_i];
                                lines.push("  ".concat(this.formatLoopLine(loop)));
                            }
                        }
                        return [2 /*return*/, { text: lines.join("\n") }];
                }
            });
        });
    };
    /**
     * /loops - List all Ralph loops
     */
    PmCommandsService.prototype.handleLoops = function (_command) {
        return __awaiter(this, void 0, void 0, function () {
            var status, lines, loops, _i, loops_1, loop, runningCount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchLocalStatus()];
                    case 1:
                        status = _a.sent();
                        if (!status) {
                            return [2 /*return*/, { text: "Failed to fetch node status" }];
                        }
                        lines = ["*Ralph Loops*", ""];
                        loops = status.ralph_loops || [];
                        if (loops.length === 0) {
                            lines.push("No Ralph loops running");
                        }
                        else {
                            for (_i = 0, loops_1 = loops; _i < loops_1.length; _i++) {
                                loop = loops_1[_i];
                                lines.push(this.formatLoopLine(loop));
                            }
                            runningCount = loops.filter(function (l) { return l.status === "running"; }).length;
                            lines.push("");
                            lines.push("Total: ".concat(loops.length, " loops (").concat(runningCount, " running)"));
                        }
                        return [2 /*return*/, { text: lines.join("\n") }];
                }
            });
        });
    };
    /**
     * /start - Start a Ralph loop
     * Usage: /start <worktree_id> <prompt>
     */
    PmCommandsService.prototype.handleStart = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, worktreeId, promptParts, prompt, response, error, data, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (command.args.length < 2) {
                            return [2 /*return*/, {
                                    text: "Usage: /start <worktree_id> <prompt>\n\nExample: /start auth-fix Fix authentication bug in auth.ts",
                                }];
                        }
                        _a = command.args, worktreeId = _a[0], promptParts = _a.slice(1);
                        prompt = promptParts.join(" ");
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, fetch("http://".concat(LOCALHOST, ":").concat(API_PORT, "/api/ralph-loops"), {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                signal: AbortSignal.timeout(API_TIMEOUT_MS),
                                body: JSON.stringify({
                                    worktree_id: worktreeId,
                                    prompt: prompt,
                                }),
                            })];
                    case 2:
                        response = _b.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.json()];
                    case 3:
                        error = _b.sent();
                        return [2 /*return*/, {
                                text: "Failed to start Ralph loop: ".concat(JSON.stringify(error)),
                            }];
                    case 4: return [4 /*yield*/, response.json()];
                    case 5:
                        data = (_b.sent());
                        return [2 /*return*/, {
                                text: "Ralph loop started:\n".concat(this.formatLoopLine(data.data.loop)),
                            }];
                    case 6:
                        error_2 = _b.sent();
                        return [2 /*return*/, {
                                text: "Failed to start Ralph loop: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)),
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * /stop - Stop a Ralph loop
     * Usage: /stop <loop_id>
     */
    PmCommandsService.prototype.handleStop = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var loopId, response, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (command.args.length < 1) {
                            return [2 /*return*/, {
                                    text: "Usage: /stop <loop_id>\n\nExample: /stop auth-fix",
                                }];
                        }
                        loopId = command.args[0];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, fetch("http://".concat(LOCALHOST, ":").concat(API_PORT, "/api/ralph-loops/").concat(loopId), {
                                method: "DELETE",
                                signal: AbortSignal.timeout(API_TIMEOUT_MS),
                            })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            return [2 /*return*/, {
                                    text: "Failed to stop Ralph loop: HTTP ".concat(response.status),
                                }];
                        }
                        return [2 /*return*/, {
                                text: "Ralph loop stopped: ".concat(loopId),
                            }];
                    case 3:
                        error_3 = _a.sent();
                        return [2 /*return*/, {
                                text: "Failed to stop Ralph loop: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)),
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * /logs - Get recent logs for a Ralph loop
     * Usage: /logs <loop_id>
     */
    PmCommandsService.prototype.handleLogs = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var loopId, response, data, logs, lines, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (command.args.length < 1) {
                            return [2 /*return*/, {
                                    text: "Usage: /logs <loop_id>\n\nExample: /logs auth-fix",
                                }];
                        }
                        loopId = command.args[0];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch("http://".concat(LOCALHOST, ":").concat(API_PORT, "/api/ralph-loops/").concat(loopId, "/logs"), {
                                signal: AbortSignal.timeout(API_TIMEOUT_MS),
                            })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            return [2 /*return*/, {
                                    text: "Failed to fetch logs: HTTP ".concat(response.status),
                                }];
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = (_a.sent());
                        logs = data.data.logs;
                        lines = logs.split("\n").slice(-50);
                        return [2 /*return*/, {
                                text: "Logs for ".concat(loopId, ":\n```\n").concat(lines.join("\n"), "\n```"),
                                parse_mode: "Markdown",
                            }];
                    case 4:
                        error_4 = _a.sent();
                        return [2 /*return*/, {
                                text: "Failed to fetch logs: ".concat(error_4 instanceof Error ? error_4.message : String(error_4)),
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * /lanes - List worktrees
     */
    PmCommandsService.prototype.handleLanes = function (_command) {
        return __awaiter(this, void 0, void 0, function () {
            var status, lines, _loop_1, _i, _a, wt;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.fetchLocalStatus()];
                    case 1:
                        status = _b.sent();
                        if (!status) {
                            return [2 /*return*/, { text: "Failed to fetch node status" }];
                        }
                        lines = ["*Worktrees*", ""];
                        if (status.worktrees.length === 0) {
                            lines.push("No worktrees found");
                        }
                        else {
                            _loop_1 = function (wt) {
                                lines.push("`".concat(wt.id, "` - ").concat(wt.branch));
                                var ralphLoop = status.ralph_loops.find(function (loop) { return loop.worktree_id === wt.id; });
                                if (ralphLoop) {
                                    lines.push("  Ralph: ".concat(ralphLoop.status, " (").concat(ralphLoop.iteration, " iterations)"));
                                }
                            };
                            for (_i = 0, _a = status.worktrees; _i < _a.length; _i++) {
                                wt = _a[_i];
                                _loop_1(wt);
                            }
                        }
                        return [2 /*return*/, { text: lines.join("\n") }];
                }
            });
        });
    };
    /**
     * /health - Show PM daemon health status
     */
    PmCommandsService.prototype.handleHealth = function (_command) {
        return __awaiter(this, void 0, void 0, function () {
            var status, lines;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchLocalStatus()];
                    case 1:
                        status = _a.sent();
                        lines = [
                            "*PM Daemon Health*",
                            "",
                            "Mode: Single-node (local)",
                            "Node: ".concat((status === null || status === void 0 ? void 0 : status.node_id) || "unknown"),
                        ];
                        if (status) {
                            lines.push("");
                            lines.push("*Capacity:*");
                            lines.push("  CPU: ".concat(status.capacity.cpu_percent, "%"));
                            lines.push("  Memory: ".concat(status.capacity.memory_percent, "%"));
                            lines.push("  Disk: ".concat(status.capacity.disk_percent, "%"));
                            lines.push("");
                            lines.push("*Ralph Loops:* ".concat(status.ralph_loops.length));
                            lines.push("*Worktrees:* ".concat(status.worktrees.length));
                        }
                        return [2 /*return*/, { text: lines.join("\n") }];
                }
            });
        });
    };
    /**
     * /help - Show available commands
     */
    PmCommandsService.prototype.handleHelp = function (_command) {
        return __awaiter(this, void 0, void 0, function () {
            var lines, _i, _a, handler;
            return __generator(this, function (_b) {
                lines = [
                    "*Available Commands*",
                    "",
                ];
                for (_i = 0, _a = this.handlers.values(); _i < _a.length; _i++) {
                    handler = _a[_i];
                    if (handler.command === "chat") {
                        continue; // Skip chat command
                    }
                    lines.push("/".concat(handler.command, " - ").concat(handler.description));
                }
                return [2 /*return*/, { text: lines.join("\n") }];
            });
        });
    };
    /**
     * chat - Non-command messages (forward to PM brain)
     */
    PmCommandsService.prototype.handleChat = function (_command) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Return empty text to signal "forward to brain"
                return [2 /*return*/, {
                        text: "",
                    }];
            });
        });
    };
    // ========================================================================
    // Helper Methods
    // ========================================================================
    /**
     * Fetch local node status
     */
    PmCommandsService.prototype.fetchLocalStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("http://".concat(LOCALHOST, ":").concat(API_PORT, "/api/status"), {
                                signal: AbortSignal.timeout(API_TIMEOUT_MS),
                            })];
                    case 1:
                        response = _b.sent();
                        if (!response.ok) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = (_b.sent());
                        return [2 /*return*/, data.data || null];
                    case 3:
                        _a = _b.sent();
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Format loop line
     */
    PmCommandsService.prototype.formatLoopLine = function (loop) {
        var statusEmoji = loop.status === "running" ? "🔄" : loop.status === "complete" ? "✅" : loop.status === "error" ? "❌" : "⏸️";
        return "".concat(statusEmoji, " `").concat(loop.id, "` - ").concat(loop.status, " (iter ").concat(loop.iteration, ")");
    };
    return PmCommandsService;
}());
exports.PmCommandsService = PmCommandsService;
