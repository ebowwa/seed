"use strict";
// Ralph Loop Management Service
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
exports.RalphService = void 0;
var fs_1 = require("fs");
var child_process_1 = require("child_process");
var util_1 = require("util");
var path_1 = require("path");
var git_1 = require("./git");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
// Configuration
var NODE_AGENT_DIR = path_1.default.join(process.env.HOME || "", ".node-agent");
var PIDS_DIR = path_1.default.join(NODE_AGENT_DIR, "pids");
var LOGS_DIR = path_1.default.join(NODE_AGENT_DIR, "logs");
var RalphService = /** @class */ (function () {
    function RalphService() {
        this.processes = new Map();
        this.gitService = new git_1.GitService();
        this.ensureDirectories();
    }
    RalphService.prototype.ensureDirectories = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs_1.promises.mkdir(NODE_AGENT_DIR, { recursive: true })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, fs_1.promises.mkdir(PIDS_DIR, { recursive: true })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, fs_1.promises.mkdir(LOGS_DIR, { recursive: true })];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * List all Ralph loops (by checking state files and tracking processes)
     */
    RalphService.prototype.listRalphLoops = function () {
        return __awaiter(this, void 0, void 0, function () {
            var worktrees, loops, _i, worktrees_1, worktree, stateFile, content, state, pidFile, processId, status_1, pid, _a, recentCommits, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.gitService.listWorktrees()];
                    case 1:
                        worktrees = _c.sent();
                        loops = [];
                        _i = 0, worktrees_1 = worktrees;
                        _c.label = 2;
                    case 2:
                        if (!(_i < worktrees_1.length)) return [3 /*break*/, 16];
                        worktree = worktrees_1[_i];
                        stateFile = path_1.default.join(worktree.path, ".claude", "ralph-loop.local.md");
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 14, , 15]);
                        return [4 /*yield*/, fs_1.promises.readFile(stateFile, "utf-8")];
                    case 4:
                        content = _c.sent();
                        state = this.parseStateFile(content);
                        pidFile = path_1.default.join(PIDS_DIR, "".concat(worktree.id, ".pid"));
                        processId = void 0;
                        status_1 = "stopped";
                        return [4 /*yield*/, this.fileExists(pidFile)];
                    case 5:
                        if (!_c.sent()) return [3 /*break*/, 11];
                        _a = parseInt;
                        return [4 /*yield*/, fs_1.promises.readFile(pidFile, "utf-8")];
                    case 6:
                        pid = _a.apply(void 0, [_c.sent(), 10]);
                        return [4 /*yield*/, this.isProcessRunning(pid)];
                    case 7:
                        if (!_c.sent()) return [3 /*break*/, 8];
                        processId = pid;
                        status_1 = "running";
                        return [3 /*break*/, 10];
                    case 8:
                        // Process ended but state file exists = complete
                        status_1 = "complete";
                        // Clean up stale PID file
                        return [4 /*yield*/, fs_1.promises.unlink(pidFile)];
                    case 9:
                        // Clean up stale PID file
                        _c.sent();
                        _c.label = 10;
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        if (state.active) {
                            // State file says active but no PID file = orphaned
                            status_1 = "stopped";
                        }
                        _c.label = 12;
                    case 12: return [4 /*yield*/, this.gitService.getRecentCommits(worktree.path, 5)];
                    case 13:
                        recentCommits = _c.sent();
                        loops.push({
                            id: worktree.id,
                            worktree_id: worktree.id,
                            status: status_1,
                            prompt: state.prompt,
                            iteration: state.iteration,
                            max_iterations: state.max_iterations,
                            completion_promise: state.completion_promise,
                            started_at: state.started_at,
                            process_id: process_id,
                            recent_commits: recentCommits,
                        });
                        return [3 /*break*/, 15];
                    case 14:
                        _b = _c.sent();
                        // No state file, skip
                        return [3 /*break*/, 15];
                    case 15:
                        _i++;
                        return [3 /*break*/, 2];
                    case 16: return [2 /*return*/, loops];
                }
            });
        });
    };
    /**
     * Get a specific Ralph loop by ID
     */
    RalphService.prototype.getRalphLoop = function (loopId) {
        return __awaiter(this, void 0, void 0, function () {
            var loops;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.listRalphLoops()];
                    case 1:
                        loops = _a.sent();
                        return [2 /*return*/, loops.find(function (loop) { return loop.id === loopId; }) || null];
                }
            });
        });
    };
    /**
     * Start a new Ralph loop
     */
    RalphService.prototype.startRalphLoop = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var worktrees, worktree, loopId, stateFile, pidFile, logFile, pid, _a, stateContent, stateFileContent, settingsFile, settingsContent, dopplerProject, dopplerConfig, args, options, child, logEntry;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.gitService.listWorktrees()];
                    case 1:
                        worktrees = _b.sent();
                        worktree = worktrees.find(function (w) { return w.id === request.worktree_id; });
                        if (!worktree) {
                            throw new Error("WORKTREE_NOT_FOUND");
                        }
                        loopId = worktree.id;
                        stateFile = path_1.default.join(worktree.path, ".claude", "ralph-loop.local.md");
                        pidFile = path_1.default.join(PIDS_DIR, "".concat(loopId, ".pid"));
                        logFile = path_1.default.join(LOGS_DIR, "".concat(loopId, ".log"));
                        return [4 /*yield*/, this.fileExists(pidFile)];
                    case 2:
                        if (!_b.sent()) return [3 /*break*/, 5];
                        _a = parseInt;
                        return [4 /*yield*/, fs_1.promises.readFile(pidFile, "utf-8")];
                    case 3:
                        pid = _a.apply(void 0, [_b.sent(), 10]);
                        return [4 /*yield*/, this.isProcessRunning(pid)];
                    case 4:
                        if (_b.sent()) {
                            throw new Error("RALPH_LOOP_ALREADY_RUNNING");
                        }
                        _b.label = 5;
                    case 5:
                        stateContent = {
                            active: true,
                            iteration: 0,
                            max_iterations: request.max_iterations || 0,
                            completion_promise: request.completion_promise || null,
                            started_at: new Date().toISOString(),
                            prompt: request.prompt,
                        };
                        stateFileContent = this.formatStateFile(stateContent);
                        return [4 /*yield*/, fs_1.promises.writeFile(stateFile, stateFileContent)];
                    case 6:
                        _b.sent();
                        settingsFile = path_1.default.join(worktree.path, ".claude", "settings.local.json");
                        settingsContent = {
                            permissions: {
                                allow: [
                                    "Skill(ralph-loop:ralph-loop)",
                                    "Bash(git:*)",
                                    "Bash(bun:*)",
                                    "Bash(npm:*)",
                                    "Bash(curl:*)",
                                    "Bash(node:*)",
                                    "Bash(python:*)",
                                    "Bash(python3:*)",
                                ],
                            },
                        };
                        return [4 /*yield*/, fs_1.promises.writeFile(settingsFile, JSON.stringify(settingsContent, null, 2))];
                    case 7:
                        _b.sent();
                        dopplerProject = process.env.DOPPLER_PROJECT || "seed";
                        dopplerConfig = process.env.DOPPLER_CONFIG || "prd";
                        args = [
                            "run",
                            "--project",
                            dopplerProject,
                            "--config",
                            dopplerConfig,
                            "--",
                            "claude",
                        ];
                        options = {
                            cwd: worktree.path,
                            detached: true,
                            stdio: ["ignore", "ignore", "ignore"],
                        };
                        child = (0, child_process_1.spawn)("doppler", args, options);
                        child.unref();
                        // Wait a moment to ensure it started
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 8:
                        // Wait a moment to ensure it started
                        _b.sent();
                        if (!child.pid) {
                            throw new Error("PROCESS_START_FAILED");
                        }
                        // Save PID
                        return [4 /*yield*/, fs_1.promises.writeFile(pidFile, child.pid.toString())];
                    case 9:
                        // Save PID
                        _b.sent();
                        this.processes.set(loopId, child.pid);
                        logEntry = "[".concat(new Date().toISOString(), "] Started Ralph loop with PID: ").concat(child.pid, "\n");
                        return [4 /*yield*/, fs_1.promises.appendFile(logFile, logEntry)];
                    case 10:
                        _b.sent();
                        return [2 /*return*/, {
                                id: loopId,
                                worktree_id: request.worktree_id,
                                status: "running",
                                prompt: request.prompt,
                                iteration: 0,
                                max_iterations: request.max_iterations || 0,
                                completion_promise: request.completion_promise || null,
                                started_at: stateContent.started_at,
                                process_id: child.pid,
                            }];
                }
            });
        });
    };
    /**
     * Stop a Ralph loop
     */
    RalphService.prototype.stopRalphLoop = function (loopId) {
        return __awaiter(this, void 0, void 0, function () {
            var worktrees, worktree, pidFile, stateFile, logFile, pid, _a, _b, logEntry;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.gitService.listWorktrees()];
                    case 1:
                        worktrees = _c.sent();
                        worktree = worktrees.find(function (w) { return w.id === loopId; });
                        if (!worktree) {
                            throw new Error("WORKTREE_NOT_FOUND");
                        }
                        pidFile = path_1.default.join(PIDS_DIR, "".concat(loopId, ".pid"));
                        stateFile = path_1.default.join(worktree.path, ".claude", "ralph-loop.local.md");
                        logFile = path_1.default.join(LOGS_DIR, "".concat(loopId, ".log"));
                        return [4 /*yield*/, this.fileExists(pidFile)];
                    case 2:
                        if (!_c.sent()) return [3 /*break*/, 11];
                        _a = parseInt;
                        return [4 /*yield*/, fs_1.promises.readFile(pidFile, "utf-8")];
                    case 3:
                        pid = _a.apply(void 0, [_c.sent(), 10]);
                        _c.label = 4;
                    case 4:
                        _c.trys.push([4, 7, , 8]);
                        // Try graceful shutdown first
                        process.kill(pid, "SIGTERM");
                        // Wait a moment
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                    case 5:
                        // Wait a moment
                        _c.sent();
                        return [4 /*yield*/, this.isProcessRunning(pid)];
                    case 6:
                        // Force kill if still running
                        if (_c.sent()) {
                            process.kill(pid, "SIGKILL");
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        _b = _c.sent();
                        return [3 /*break*/, 8];
                    case 8: return [4 /*yield*/, fs_1.promises.unlink(pidFile)];
                    case 9:
                        _c.sent();
                        this.processes.delete(loopId);
                        logEntry = "[".concat(new Date().toISOString(), "] Stopped Ralph loop (PID: ").concat(pid, ")\n");
                        return [4 /*yield*/, fs_1.promises.appendFile(logFile, logEntry)];
                    case 10:
                        _c.sent();
                        _c.label = 11;
                    case 11: return [4 /*yield*/, this.fileExists(stateFile)];
                    case 12:
                        if (!_c.sent()) return [3 /*break*/, 14];
                        return [4 /*yield*/, fs_1.promises.unlink(stateFile)];
                    case 13:
                        _c.sent();
                        _c.label = 14;
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse Ralph loop state file
     */
    RalphService.prototype.parseStateFile = function (content) {
        var _a, _b, _c, _d, _e;
        var frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
        if (!frontmatterMatch) {
            throw new Error("INVALID_STATE_FILE");
        }
        var frontmatter = frontmatterMatch[1];
        var prompt = frontmatterMatch[2].trim();
        var state = {};
        var lines = frontmatter.split("\n");
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                var key = match[1], value = match[2];
                if (key === "active") {
                    state.active = value === "true";
                }
                else if (key === "iteration" || key === "max_iterations") {
                    state[key] = parseInt(value, 10);
                }
                else if (key === "completion_promise") {
                    state.completion_promise = value === "null" ? null : value;
                }
                else if (key === "started_at") {
                    state.started_at = value;
                }
            }
        }
        return {
            active: (_a = state.active) !== null && _a !== void 0 ? _a : true,
            iteration: (_b = state.iteration) !== null && _b !== void 0 ? _b : 0,
            max_iterations: (_c = state.max_iterations) !== null && _c !== void 0 ? _c : 0,
            completion_promise: (_d = state.completion_promise) !== null && _d !== void 0 ? _d : null,
            started_at: (_e = state.started_at) !== null && _e !== void 0 ? _e : new Date().toISOString(),
            prompt: state.prompt || prompt,
        };
    };
    /**
     * Format Ralph loop state file
     */
    RalphService.prototype.formatStateFile = function (state) {
        var _a;
        return "---\nactive: ".concat(state.active, "\niteration: ").concat(state.iteration, "\nmax_iterations: ").concat(state.max_iterations, "\ncompletion_promise: ").concat((_a = state.completion_promise) !== null && _a !== void 0 ? _a : "null", "\nstarted_at: ").concat(state.started_at, "\n---\n\n").concat(state.prompt, "\n");
    };
    /**
     * Check if a file exists
     */
    RalphService.prototype.fileExists = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fs_1.promises.access(filePath)];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if a process is running
     */
    RalphService.prototype.isProcessRunning = function (pid) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    process.kill(pid, 0); // Signal 0 checks if process exists
                    return [2 /*return*/, true];
                }
                catch (_b) {
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    return RalphService;
}());
exports.RalphService = RalphService;
