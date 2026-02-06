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
var console_logger_1 = require("./console-logger");
var url_1 = require("url");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
// Configuration
var NODE_AGENT_DIR = path_1.default.join(process.env.HOME || "", ".node-agent");
var PIDS_DIR = path_1.default.join(NODE_AGENT_DIR, "pids");
var LOGS_DIR = path_1.default.join(NODE_AGENT_DIR, "logs");
// Directories to scan for Ralph Iterative state files
var RALPH_SCAN_DIRS = [
    path_1.default.join(process.env.HOME || "", "seed"), // Main seed directory
    path_1.default.join(process.env.HOME || "", "seed", "worktrees"), // Worktrees
];
var RalphService = /** @class */ (function () {
    function RalphService() {
        this.pids = new Map();
        this.activeProcesses = new Map();
        this.gitService = new git_1.GitService();
        this.consoleLogger = new console_logger_1.ConsoleLoggerService();
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
     *
     * Scans for:
     * 1. .claude/.ralph-iterative.*.json files (new Ralph Iterative skill)
     * 2. .claude/ralph-loop.local.md files (legacy format)
     *
     * TODO: Add caching for Ralph state files to avoid repeated disk reads
     * TODO: Consider using fs.watch() for real-time updates instead of polling
     */
    RalphService.prototype.listRalphLoops = function () {
        return __awaiter(this, void 0, void 0, function () {
            var loops, runningProcessIds, iterativeFiles, _loop_1, this_1, _i, iterativeFiles_1, _a, filePath, projectName, worktrees, _b, worktrees_1, worktree, stateFile, content, state, pidFile, processId, status_1, pid, _c, now, completedAt, hoursSinceComplete, recentCommits, _d;
            var _e, _f, _g, _h, _j, _k, _l, _m, _o;
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0:
                        loops = [];
                        runningProcessIds = Array.from(this.activeProcesses.keys());
                        return [4 /*yield*/, this.findRalphIterativeStateFiles()];
                    case 1:
                        iterativeFiles = _p.sent();
                        _loop_1 = function (filePath, projectName) {
                            var content, state, status_2, loopId, isProcessRunning, _q, _r, id, subtasks, totalSubtasks, completedSubtasks, currentSubtaskId_1, currentSubtask, projectDir, homeDir, projectPath, gitInfo, processId, _s;
                            return __generator(this, function (_t) {
                                switch (_t.label) {
                                    case 0:
                                        _t.trys.push([0, 6, , 7]);
                                        return [4 /*yield*/, fs_1.promises.readFile(filePath, "utf-8")];
                                    case 1:
                                        content = _t.sent();
                                        state = JSON.parse(content);
                                        status_2 = "stopped";
                                        loopId = "".concat(projectName, "-").concat(state.iteration);
                                        _q = this_1.activeProcesses.has(loopId);
                                        if (_q) return [3 /*break*/, 4];
                                        _r = this_1.pids.get(loopId);
                                        if (!_r) return [3 /*break*/, 3];
                                        return [4 /*yield*/, this_1.isProcessRunning(this_1.pids.get(loopId))];
                                    case 2:
                                        _r = (_t.sent());
                                        _t.label = 3;
                                    case 3:
                                        _q = (_r);
                                        _t.label = 4;
                                    case 4:
                                        isProcessRunning = _q;
                                        if (((_e = state.slam) === null || _e === void 0 ? void 0 : _e.phase) === "complete") {
                                            status_2 = "complete";
                                        }
                                        else if (((_f = state.slam) === null || _f === void 0 ? void 0 : _f.phase) === "planning") {
                                            status_2 = isProcessRunning ? "starting" : "stopped";
                                        }
                                        else if (isProcessRunning) {
                                            status_2 = "running";
                                        }
                                        // Skip loops that are complete AND not running (cleanup old completed loops)
                                        if (status_2 === "complete" && !isProcessRunning) {
                                            return [2 /*return*/, "continue"];
                                        }
                                        // Skip stopped loops unless they're the most recent one for this project
                                        if (status_2 === "stopped") {
                                            return [2 /*return*/, "continue"];
                                        }
                                        id = loopId;
                                        subtasks = ((_g = state.slam) === null || _g === void 0 ? void 0 : _g.subtasks) || [];
                                        totalSubtasks = subtasks.length;
                                        completedSubtasks = ((_j = (_h = state.slam) === null || _h === void 0 ? void 0 : _h.completedSubtasks) === null || _j === void 0 ? void 0 : _j.length) || 0;
                                        currentSubtaskId_1 = (_k = state.slam) === null || _k === void 0 ? void 0 : _k.currentSubtask;
                                        currentSubtask = subtasks.find(function (st) { return st.id === currentSubtaskId_1; });
                                        projectDir = path_1.default.dirname(path_1.default.dirname(filePath));
                                        homeDir = process.env.HOME || "";
                                        projectPath = projectDir;
                                        if (projectDir.startsWith(homeDir)) {
                                            projectPath = "~" + projectDir.slice(homeDir.length);
                                        }
                                        return [4 /*yield*/, this_1.getGitInfo(projectDir)];
                                    case 5:
                                        gitInfo = _t.sent();
                                        processId = this_1.pids.get(id);
                                        loops.push({
                                            id: id,
                                            worktree_id: projectName,
                                            status: status_2,
                                            prompt: state.prompt,
                                            iteration: state.iteration,
                                            max_iterations: 0, // Ralph Iterative doesn't use max_iterations
                                            completion_promise: state.promise || null,
                                            started_at: state.startTime,
                                            last_activity: state.lastUpdate,
                                            process_id: process_id,
                                            project_path: projectPath,
                                            git_info: gitInfo,
                                            // Ralph Iterative specific fields
                                            phase: (_l = state.slam) === null || _l === void 0 ? void 0 : _l.phase,
                                            current_task: (currentSubtask === null || currentSubtask === void 0 ? void 0 : currentSubtask.title) || ((_o = (_m = state.slam) === null || _m === void 0 ? void 0 : _m.state) === null || _o === void 0 ? void 0 : _o.currentTask),
                                            total_subtasks: totalSubtasks,
                                            completed_subtasks: completedSubtasks,
                                            subtasks: subtasks.map(function (st) { return ({
                                                id: st.id,
                                                title: st.title,
                                                status: st.status,
                                            }); }),
                                        });
                                        return [3 /*break*/, 7];
                                    case 6:
                                        _s = _t.sent();
                                        return [2 /*return*/, "continue"];
                                    case 7: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, iterativeFiles_1 = iterativeFiles;
                        _p.label = 2;
                    case 2:
                        if (!(_i < iterativeFiles_1.length)) return [3 /*break*/, 5];
                        _a = iterativeFiles_1[_i], filePath = _a.filePath, projectName = _a.projectName;
                        return [5 /*yield**/, _loop_1(filePath, projectName)];
                    case 3:
                        _p.sent();
                        _p.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, this.gitService.listWorktrees()];
                    case 6:
                        worktrees = _p.sent();
                        _b = 0, worktrees_1 = worktrees;
                        _p.label = 7;
                    case 7:
                        if (!(_b < worktrees_1.length)) return [3 /*break*/, 21];
                        worktree = worktrees_1[_b];
                        stateFile = path_1.default.join(worktree.path, ".claude", "ralph-loop.local.md");
                        _p.label = 8;
                    case 8:
                        _p.trys.push([8, 19, , 20]);
                        return [4 /*yield*/, fs_1.promises.readFile(stateFile, "utf-8")];
                    case 9:
                        content = _p.sent();
                        state = this.parseStateFile(content);
                        pidFile = path_1.default.join(PIDS_DIR, "".concat(worktree.id, ".pid"));
                        processId = void 0;
                        status_1 = "stopped";
                        return [4 /*yield*/, this.fileExists(pidFile)];
                    case 10:
                        if (!_p.sent()) return [3 /*break*/, 16];
                        _c = parseInt;
                        return [4 /*yield*/, fs_1.promises.readFile(pidFile, "utf-8")];
                    case 11:
                        pid = _c.apply(void 0, [_p.sent(), 10]);
                        return [4 /*yield*/, this.isProcessRunning(pid)];
                    case 12:
                        if (!_p.sent()) return [3 /*break*/, 13];
                        processId = pid;
                        status_1 = "running";
                        return [3 /*break*/, 15];
                    case 13:
                        // Process ended but state file exists = complete
                        status_1 = "complete";
                        // Clean up stale PID file
                        return [4 /*yield*/, fs_1.promises.unlink(pidFile)];
                    case 14:
                        // Clean up stale PID file
                        _p.sent();
                        _p.label = 15;
                    case 15: return [3 /*break*/, 17];
                    case 16:
                        if (state.active) {
                            // State file says active but no PID file = orphaned
                            status_1 = "stopped";
                        }
                        _p.label = 17;
                    case 17:
                        // Skip complete and stopped loops - only return actively running loops
                        if (status_1 === "stopped") {
                            return [3 /*break*/, 20];
                        }
                        // For complete loops, only include if they just finished recently (last 5 minutes)
                        if (status_1 === "complete") {
                            now = Date.now();
                            completedAt = new Date(state.started_at).getTime();
                            hoursSinceComplete = (now - completedAt) / (1000 * 60 * 60);
                            if (hoursSinceComplete > 0.1) { // 6 minutes
                                return [3 /*break*/, 20]; // Skip old completed loops
                            }
                        }
                        return [4 /*yield*/, this.gitService.getRecentCommits(worktree.path, 5)];
                    case 18:
                        recentCommits = _p.sent();
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
                        return [3 /*break*/, 20];
                    case 19:
                        _d = _p.sent();
                        // No state file, skip
                        return [3 /*break*/, 20];
                    case 20:
                        _b++;
                        return [3 /*break*/, 7];
                    case 21: return [2 /*return*/, loops];
                }
            });
        });
    };
    /**
     * Find all Ralph Iterative state files (.claude/.ralph-iterative.*.json)
     * by scanning configured directories recursively
     */
    RalphService.prototype.findRalphIterativeStateFiles = function () {
        return __awaiter(this, void 0, void 0, function () {
            var results, _i, RALPH_SCAN_DIRS_1, scanDir, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        results = [];
                        _i = 0, RALPH_SCAN_DIRS_1 = RALPH_SCAN_DIRS;
                        _b.label = 1;
                    case 1:
                        if (!(_i < RALPH_SCAN_DIRS_1.length)) return [3 /*break*/, 6];
                        scanDir = RALPH_SCAN_DIRS_1[_i];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.scanDirectoryForRalphFiles(scanDir, results)];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _b.sent();
                        // Directory doesn't exist or isn't accessible, skip
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Recursively scan a directory for .claude/.ralph-iterative.*.json files
     */
    RalphService.prototype.scanDirectoryForRalphFiles = function (dirPath, results) {
        return __awaiter(this, void 0, void 0, function () {
            var entries, _i, entries_1, entry, fullPath, parentDir, projectName, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, fs_1.promises.readdir(dirPath, { withFileTypes: true })];
                    case 1:
                        entries = _b.sent();
                        _i = 0, entries_1 = entries;
                        _b.label = 2;
                    case 2:
                        if (!(_i < entries_1.length)) return [3 /*break*/, 6];
                        entry = entries_1[_i];
                        fullPath = path_1.default.join(dirPath, entry.name);
                        if (!entry.isDirectory()) return [3 /*break*/, 4];
                        // Skip node_modules and hidden dirs (except .claude)
                        if (entry.name === "node_modules" || (entry.name.startsWith(".") && entry.name !== ".claude")) {
                            return [3 /*break*/, 5];
                        }
                        // Recursively scan subdirectories
                        return [4 /*yield*/, this.scanDirectoryForRalphFiles(fullPath, results)];
                    case 3:
                        // Recursively scan subdirectories
                        _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        if (entry.name.startsWith(".ralph-iterative.") && entry.name.endsWith(".json")) {
                            parentDir = path_1.default.basename(dirPath);
                            projectName = parentDir === ".claude" ? path_1.default.basename(path_1.default.dirname(dirPath)) : parentDir;
                            results.push({
                                filePath: fullPath,
                                projectName: projectName,
                            });
                        }
                        _b.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        _a = _b.sent();
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
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
     * Start a new Ralph loop using Ralph Iterative format
     *
     * Creates .claude/.ralph-iterative.local.json with SLAM state
     * and spawns Claude Code which will detect the file and start iterating.
     */
    RalphService.prototype.startRalphLoop = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var worktrees, worktree, loopId, pidFile, logFile, stateFilePath, pid, _a, machineInfo, now, stateContent, claudeDir, settingsFile, settingsContent, dopplerProject, dopplerConfig, options, supervisorPath, args, child, logEntry;
            var _this = this;
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
                        pidFile = path_1.default.join(PIDS_DIR, "".concat(loopId, ".pid"));
                        logFile = path_1.default.join(LOGS_DIR, "".concat(loopId, ".log"));
                        stateFilePath = path_1.default.join(worktree.path, ".claude", ".ralph-iterative.local.json");
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
                    case 5: return [4 /*yield*/, this.fileExists(stateFilePath)];
                    case 6:
                        // Check if state file already exists (Ralph Iterative session already active)
                        if (_b.sent()) {
                            throw new Error("RALPH_ITERATIVE_ALREADY_ACTIVE");
                        }
                        return [4 /*yield*/, this.detectMachineResources()];
                    case 7:
                        machineInfo = _b.sent();
                        now = new Date().toISOString();
                        stateContent = {
                            prompt: request.prompt,
                            promise: request.completion_promise || "TASK_COMPLETE",
                            iteration: 0,
                            startTime: now,
                            lastUpdate: now,
                            tokens: {
                                totalInput: 0,
                                totalOutput: 0,
                                byIteration: [],
                            },
                            filesChanged: [],
                            workMemory: {
                                completedFiles: [],
                                fileChecksums: {},
                            },
                            machine: machineInfo,
                            git: {
                                enabled: request.auto_commit || request.auto_pr || false,
                                autoCommit: request.auto_commit || request.auto_pr || false,
                                autoPR: request.auto_pr || false,
                                baseBranch: request.base_branch || "main",
                                useLane: false,
                                useWorktree: true,
                                laneName: "",
                                lanePath: "",
                                laneCreated: false,
                                branchCreated: false,
                                branchName: "",
                                currentCommit: "",
                            },
                            slam: {
                                enabled: request.enable_subagents || false,
                                phase: "planning",
                                state: {
                                    currentTask: request.prompt,
                                    beliefs: {},
                                    goals: [request.completion_promise || "TASK_COMPLETE"],
                                },
                                subtasks: [],
                                currentSubtask: null,
                                completedSubtasks: [],
                                memory: {
                                    actionsTaken: [],
                                    outcomes: {},
                                    patterns: {},
                                },
                            },
                            subagents: {
                                enabled: request.enable_subagents || false,
                                available: [
                                    "planner",
                                    "executor",
                                    "reviewer",
                                    "fixer",
                                    "git",
                                    "reporter",
                                    "paranoid",
                                    "healer",
                                    "manager",
                                ],
                                active: [],
                            },
                        };
                        claudeDir = path_1.default.join(worktree.path, ".claude");
                        return [4 /*yield*/, fs_1.promises.mkdir(claudeDir, { recursive: true })];
                    case 8:
                        _b.sent();
                        // Write Ralph Iterative state file
                        return [4 /*yield*/, fs_1.promises.writeFile(stateFilePath, JSON.stringify(stateContent, null, 2))];
                    case 9:
                        // Write Ralph Iterative state file
                        _b.sent();
                        settingsFile = path_1.default.join(worktree.path, ".claude", "settings.local.json");
                        settingsContent = {
                            permissions: {
                                allow: [
                                    "Skill(ralph-iterative:ralph-iterative)",
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
                    case 10:
                        _b.sent();
                        dopplerProject = process.env.DOPPLER_PROJECT || "seed";
                        dopplerConfig = process.env.DOPPLER_CONFIG || "prd";
                        options = {
                            cwd: worktree.path,
                            stdio: ["pipe", "pipe", "pipe"],
                        };
                        supervisorPath = path_1.default.join(path_1.default.dirname((0, url_1.fileURLToPath)(import.meta.url)), "..", "lib", "rolling-keys-supervisor.ts");
                        args = [
                            "run",
                            "--project",
                            dopplerProject,
                            "--config",
                            dopplerConfig,
                            "--",
                            "bun",
                            "run",
                            supervisorPath,
                        ];
                        child = (0, child_process_1.spawn)("doppler", args, options);
                        if (!child.pid || !child.stdin || !child.stdout) {
                            throw new Error("PROCESS_START_FAILED");
                        }
                        // Store process handle for WebSocket access
                        this.activeProcesses.set(loopId, {
                            process: child,
                            stdout: child.stdout,
                            stdin: child.stdin,
                        });
                        // Handle process exit - cleanup
                        child.on("exit", function (code) {
                            console.log("[RalphService] Loop ".concat(loopId, " exited with code ").concat(code));
                            _this.consoleLogger.logProcessStop(child.pid);
                            _this.pids.delete(loopId);
                            _this.activeProcesses.delete(loopId);
                        });
                        child.on("error", function (err) {
                            console.error("[RalphService] Loop ".concat(loopId, " error:"), err);
                            _this.consoleLogger.logProcessStop(child.pid);
                            _this.pids.delete(loopId);
                            _this.activeProcesses.delete(loopId);
                        });
                        // Wait a moment to ensure it started
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 11:
                        // Wait a moment to ensure it started
                        _b.sent();
                        // Save PID
                        return [4 /*yield*/, fs_1.promises.writeFile(pidFile, child.pid.toString())];
                    case 12:
                        // Save PID
                        _b.sent();
                        this.pids.set(loopId, child.pid);
                        // Log the start with console logger
                        this.consoleLogger.logProcessStart(child.pid, worktree.id, loopId);
                        logEntry = "[".concat(new Date().toISOString(), "] Started Ralph Iterative loop with PID: ").concat(child.pid, "\n");
                        return [4 /*yield*/, fs_1.promises.appendFile(logFile, logEntry)];
                    case 13:
                        _b.sent();
                        return [2 /*return*/, {
                                id: loopId,
                                worktree_id: request.worktree_id,
                                status: "running",
                                prompt: request.prompt,
                                iteration: 0,
                                max_iterations: 0,
                                completion_promise: request.completion_promise || null,
                                started_at: now,
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
                        this.pids.delete(loopId);
                        this.activeProcesses.delete(loopId);
                        // Log the stop with console logger
                        this.consoleLogger.logProcessStop(pid);
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
    /**
     * Get git remote and branch info for a directory
     */
    RalphService.prototype.getGitInfo = function (projectDir) {
        return __awaiter(this, void 0, void 0, function () {
            var branch, branchOutput, _a, remote, remoteOutput, remoteUrl, match, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 9, , 10]);
                        branch = null;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync("cd \"".concat(projectDir, "\" && git rev-parse --abbrev-ref HEAD"))];
                    case 2:
                        branchOutput = (_d.sent()).stdout;
                        branch = branchOutput.trim() || null;
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _d.sent();
                        branch = null;
                        return [3 /*break*/, 4];
                    case 4:
                        remote = null;
                        _d.label = 5;
                    case 5:
                        _d.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, execAsync("cd \"".concat(projectDir, "\" && git config --get remote.origin.url"))];
                    case 6:
                        remoteOutput = (_d.sent()).stdout;
                        remoteUrl = remoteOutput.trim();
                        match = remoteUrl.match(/[:/]([^\/]+\/[^\/\.]+)(\.git)?$/);
                        remote = match ? match[1] : remoteUrl || null;
                        return [3 /*break*/, 8];
                    case 7:
                        _b = _d.sent();
                        remote = null;
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, { remote: remote, branch: branch }];
                    case 9:
                        _c = _d.sent();
                        return [2 /*return*/, { remote: null, branch: null }];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Detect machine resources for Ralph Iterative SLAM
     */
    RalphService.prototype.detectMachineResources = function () {
        return __awaiter(this, void 0, void 0, function () {
            var os, cpuCount, cpuModel, cpuTier, totalMem, freeMem, usedMem, totalMemGB, memTier, diskTotal, diskAvailable, diskTier, dfOutput, parts, sizeStr, availStr, _a, platform, cpuScore, memScore, diskScore, bonusScore, score, capacity;
            var _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        os = require("os");
                        cpuCount = os.cpus().length;
                        cpuModel = ((_c = os.cpus()[0]) === null || _c === void 0 ? void 0 : _c.model) || "Unknown";
                        cpuTier = "low";
                        if (cpuCount >= 16)
                            cpuTier = "high";
                        else if (cpuCount >= 8)
                            cpuTier = "medium";
                        totalMem = os.totalmem();
                        freeMem = os.freemem();
                        usedMem = totalMem - freeMem;
                        totalMemGB = Math.round(totalMem / (Math.pow(1024, 3)));
                        memTier = "low";
                        if (totalMemGB >= 32)
                            memTier = "high";
                        else if (totalMemGB >= 16)
                            memTier = "medium";
                        diskTotal = 0;
                        diskAvailable = 0;
                        diskTier = "low";
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync("df -h / | tail -1")];
                    case 2:
                        dfOutput = (_d.sent()).stdout;
                        parts = dfOutput.trim().split(/\s+/);
                        sizeStr = parts[1];
                        availStr = parts[3];
                        diskTotal = this.parseSizeToGB(sizeStr);
                        diskAvailable = this.parseSizeToGB(availStr);
                        if (diskTotal >= 500)
                            diskTier = "high";
                        else if (diskTotal >= 200)
                            diskTier = "medium";
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _d.sent();
                        // Fallback values
                        diskTotal = 100;
                        diskAvailable = 50;
                        return [3 /*break*/, 4];
                    case 4:
                        _b = {
                            os: os.type(),
                            arch: os.arch()
                        };
                        return [4 /*yield*/, this.checkIfContainer()];
                    case 5:
                        platform = (_b.isContainer = _d.sent(),
                            _b);
                        cpuScore = Math.min((cpuCount / 32) * 30, 30);
                        memScore = Math.min((totalMemGB / 128) * 30, 30);
                        diskScore = Math.min((diskTotal / 1000) * 20, 20);
                        bonusScore = platform.isContainer ? 10 : 5;
                        score = Math.round(cpuScore + memScore + diskScore + bonusScore);
                        capacity = "low";
                        if (score >= 70)
                            capacity = "high";
                        else if (score >= 40)
                            capacity = "medium";
                        return [2 /*return*/, {
                                cpu: { count: cpuCount, model: cpuModel, tier: cpuTier },
                                memory: { total: totalMemGB, free: Math.round(freeMem / (Math.pow(1024, 3))), tier: memTier },
                                disk: { total: diskTotal, available: diskAvailable, tier: diskTier },
                                platform: platform,
                                capacity: capacity,
                                score: score,
                            }];
                }
            });
        });
    };
    /**
     * Check if running in a container
     */
    RalphService.prototype.checkIfContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, stdout, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 7]);
                        // Check for Docker/.dockerenv
                        return [4 /*yield*/, execAsync("test -f /.dockerenv")];
                    case 1:
                        // Check for Docker/.dockerenv
                        _c.sent();
                        return [2 /*return*/, true];
                    case 2:
                        _a = _c.sent();
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, execAsync("cat /proc/1/cgroup")];
                    case 4:
                        stdout = (_c.sent()).stdout;
                        return [2 /*return*/, stdout.includes("docker") || stdout.includes("containerd")];
                    case 5:
                        _b = _c.sent();
                        return [2 /*return*/, false];
                    case 6: return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse size string to GB (e.g., "100G" -> 100, "500M" -> 0.5)
     */
    RalphService.prototype.parseSizeToGB = function (sizeStr) {
        var match = sizeStr.match(/^([\d.]+)([KMGT]?)(i?B?)?$/i);
        if (!match)
            return 0;
        var value = parseFloat(match[1]);
        var unit = match[2].toUpperCase();
        switch (unit) {
            case "T": return value * 1024;
            case "G": return value;
            case "M": return value / 1024;
            case "K": return value / (1024 * 1024);
            default: return value;
        }
    };
    /**
     * Get process handle for WebSocket oversight
     * Returns { stdin, stdout } for bidirectional communication with a running Ralph loop
     */
    RalphService.prototype.getProcess = function (loopId) {
        return this.activeProcesses.get(loopId);
    };
    return RalphService;
}());
exports.RalphService = RalphService;
