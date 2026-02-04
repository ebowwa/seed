"use strict";
// Console Logging Service - Simple status logging
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
exports.ConsoleLoggerService = void 0;
var child_process_1 = require("child_process");
var util_1 = require("util");
var fs_1 = require("fs");
var path_1 = require("path");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
// Configuration
var LOG_INTERVAL_MS = 30000; // Log every 30 seconds
var ConsoleLoggerService = /** @class */ (function () {
    function ConsoleLoggerService() {
        this.ralphLoops = [];
        this.claudeProcesses = [];
        this.plugins = [];
        this.intervalId = null;
        this.knownPids = new Set();
        this.logBuffer = [];
        this.MAX_LOG_ENTRIES = 100;
        this.originalConsoleLog = console.log.bind(console);
        this.originalConsoleError = console.error.bind(console);
        this.loggingActive = false;
    }
    /**
     * Get recent log entries
     */
    ConsoleLoggerService.prototype.getRecentLogs = function (limit) {
        if (limit === void 0) { limit = 20; }
        return this.logBuffer.slice(-limit);
    };
    /**
     * Add an entry to the log buffer
     */
    ConsoleLoggerService.prototype.addLog = function (level, message) {
        this.logBuffer.push({
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
        });
        if (this.logBuffer.length > this.MAX_LOG_ENTRIES) {
            this.logBuffer.shift();
        }
    };
    /**
     * Start periodic console logging
     */
    ConsoleLoggerService.prototype.startLogging = function () {
        var _this = this;
        if (this.intervalId) {
            return;
        }
        // Override console.log to capture all output
        if (!this.loggingActive) {
            console.log = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var message = args.map(String).join(" ");
                _this.addLog("info", message);
                _this.originalConsoleLog.apply(_this, args);
            };
            console.error = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var message = args.map(String).join(" ");
                _this.addLog("error", message);
                _this.originalConsoleError.apply(_this, args);
            };
            this.loggingActive = true;
        }
        this.originalConsoleLog("[NodeAgent] Console logging started (every 30s)");
        // Initial log
        this.logStatus();
        // Set up periodic logging
        this.intervalId = setInterval(function () {
            _this.logStatus();
        }, LOG_INTERVAL_MS);
    };
    /**
     * Stop periodic console logging
     */
    ConsoleLoggerService.prototype.stopLogging = function () {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.loggingActive) {
            console.log = this.originalConsoleLog;
            console.error = this.originalConsoleError;
            this.loggingActive = false;
        }
        this.originalConsoleLog("[NodeAgent] Console logging stopped");
    };
    /**
     * Update Ralph loops state
     */
    ConsoleLoggerService.prototype.updateRalphLoops = function (loops) {
        this.ralphLoops = loops;
    };
    /**
     * Log when a new Claude Code process starts
     */
    ConsoleLoggerService.prototype.logProcessStart = function (pid, worktreeId, loopId) {
        if (this.knownPids.has(pid)) {
            return;
        }
        this.knownPids.add(pid);
        var parts = ["Claude Code process started", "PID:".concat(pid)];
        if (worktreeId)
            parts.push("worktree:".concat(worktreeId));
        if (loopId)
            parts.push("loop:".concat(loopId));
        this.originalConsoleLog("[NodeAgent] ".concat(parts.join(" ")));
    };
    /**
     * Log when a Claude Code process stops
     */
    ConsoleLoggerService.prototype.logProcessStop = function (pid) {
        this.knownPids.delete(pid);
        this.claudeProcesses = this.claudeProcesses.filter(function (p) { return p.pid !== pid; });
        this.originalConsoleLog("[NodeAgent] Claude Code process stopped: PID ".concat(pid));
    };
    /**
     * Log Ralph loop state
     */
    ConsoleLoggerService.prototype.logRalphLoopState = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, loop, parts;
            var _b;
            return __generator(this, function (_c) {
                if (this.ralphLoops.length === 0) {
                    return [2 /*return*/];
                }
                for (_i = 0, _a = this.ralphLoops; _i < _a.length; _i++) {
                    loop = _a[_i];
                    parts = [
                        "Ralph loop ".concat(loop.id),
                        loop.status,
                        "iter:".concat(loop.iteration),
                    ];
                    if (loop.phase)
                        parts.push("phase:".concat(loop.phase));
                    if (loop.process_id)
                        parts.push("PID:".concat(loop.process_id));
                    if ((_b = loop.git_info) === null || _b === void 0 ? void 0 : _b.branch)
                        parts.push("branch:".concat(loop.git_info.branch));
                    this.originalConsoleLog("[NodeAgent] ".concat(parts.join(" ")));
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Log active Claude Code PIDs
     */
    ConsoleLoggerService.prototype.logActivePids = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stdout, lines, activePids, _i, lines_1, line, pid, _a, _b, knownPid, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, execAsync('ps aux | grep -E "[c]laude|[d]oppler.*claude" | awk \'{print $2}\'')];
                    case 1:
                        stdout = (_d.sent()).stdout;
                        lines = stdout.trim().split("\n").filter(function (l) { return l.length > 0; });
                        activePids = new Set();
                        for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                            line = lines_1[_i];
                            pid = parseInt(line.trim(), 10);
                            if (!isNaN(pid)) {
                                activePids.add(pid);
                                if (!this.knownPids.has(pid)) {
                                    this.logProcessStart(pid);
                                }
                            }
                        }
                        // Check for stopped PIDs
                        for (_a = 0, _b = this.knownPids; _a < _b.length; _a++) {
                            knownPid = _b[_a];
                            if (!activePids.has(knownPid)) {
                                this.logProcessStop(knownPid);
                            }
                        }
                        if (lines.length > 0) {
                            this.originalConsoleLog("[NodeAgent] Active Claude Code processes: ".concat(lines.length));
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        _c = _d.sent();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Detect and log active plugins
     */
    ConsoleLoggerService.prototype.logActivePlugins = function () {
        return __awaiter(this, void 0, void 0, function () {
            var plugins, mcpConfigPaths, _i, mcpConfigPaths_1, mcpPath, content, config, _a, _b, _c, name_1, serverConfig, sc, _d, _e, pluginsDir, entries, _f, entries_1, entry, _g, byType, parts;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        plugins = [];
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 8, , 9]);
                        mcpConfigPaths = [
                            path_1.default.join(process.env.HOME || "", ".mcp.json"),
                            path_1.default.join(process.env.HOME || "", "seed", ".mcp.json"),
                        ];
                        _i = 0, mcpConfigPaths_1 = mcpConfigPaths;
                        _h.label = 2;
                    case 2:
                        if (!(_i < mcpConfigPaths_1.length)) return [3 /*break*/, 7];
                        mcpPath = mcpConfigPaths_1[_i];
                        _h.label = 3;
                    case 3:
                        _h.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, fs_1.promises.readFile(mcpPath, "utf-8")];
                    case 4:
                        content = _h.sent();
                        config = JSON.parse(content);
                        if (config.mcpServers) {
                            for (_a = 0, _b = Object.entries(config.mcpServers); _a < _b.length; _a++) {
                                _c = _b[_a], name_1 = _c[0], serverConfig = _c[1];
                                sc = serverConfig;
                                plugins.push({
                                    name: name_1,
                                    type: "mcp",
                                    status: "active",
                                    details: sc.type || "stdio",
                                });
                            }
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        _d = _h.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        _e = _h.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        _h.trys.push([9, 11, , 12]);
                        pluginsDir = path_1.default.join(process.env.HOME || "", ".claude", "plugins");
                        return [4 /*yield*/, fs_1.promises.readdir(pluginsDir, { withFileTypes: true }).catch(function () { return []; })];
                    case 10:
                        entries = _h.sent();
                        for (_f = 0, entries_1 = entries; _f < entries_1.length; _f++) {
                            entry = entries_1[_f];
                            if (entry.isDirectory()) {
                                plugins.push({
                                    name: entry.name,
                                    type: "skill",
                                    status: "active",
                                });
                            }
                        }
                        return [3 /*break*/, 12];
                    case 11:
                        _g = _h.sent();
                        return [3 /*break*/, 12];
                    case 12:
                        this.plugins = plugins;
                        if (plugins.length > 0) {
                            byType = plugins.reduce(function (acc, p) {
                                acc[p.type] = (acc[p.type] || 0) + 1;
                                return acc;
                            }, {});
                            parts = Object.entries(byType).map(function (_a) {
                                var type = _a[0], count = _a[1];
                                return "".concat(count, " ").concat(type);
                            });
                            this.originalConsoleLog("[NodeAgent] Active plugins: ".concat(parts.join(", ")));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Main status logging function
     */
    ConsoleLoggerService.prototype.logStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.logRalphLoopState()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.logActivePids()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.logActivePlugins()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current state snapshot
     */
    ConsoleLoggerService.prototype.getState = function () {
        return {
            claudeProcesses: this.claudeProcesses,
            ralphLoops: this.ralphLoops,
            plugins: this.plugins,
            lastUpdate: new Date(),
        };
    };
    return ConsoleLoggerService;
}());
exports.ConsoleLoggerService = ConsoleLoggerService;
