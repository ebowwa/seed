"use strict";
// Node Agent - Main HTTP Server
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var ralph_1 = require("./services/ralph");
var git_1 = require("./services/git");
var console_logger_1 = require("./services/console-logger");
// PM Daemon imports (conditionally loaded)
var telegram_1 = require("./services/daemon/telegram");
var pm_commands_1 = require("./services/daemon/pm-commands");
var pm_monitor_1 = require("./services/daemon/pm-monitor");
var daemon_layer_agent_1 = require("./services/daemon/daemon-layer-agent");
// Configuration
var PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);
var HOST = process.env.NODE_AGENT_HOST || "0.0.0.0";
var CONSOLE_LOGGING_ENABLED = process.env.CONSOLE_LOGGING_ENABLED !== "false"; // Enabled by default
// Services
var gitService = new git_1.GitService();
var ralphService = new ralph_1.RalphService();
var consoleLogger = new console_logger_1.ConsoleLoggerService();
// ============================================================================
// Utility Functions
// ============================================================================
function jsonResponse(data, options) {
    if (options === void 0) { options = {}; }
    return new Response(JSON.stringify(data, null, 2), {
        status: options.status || 200,
        headers: __assign({ "Content-Type": "application/json" }, options.headers),
    });
}
function errorResponse(code, message, details) {
    var error = {
        error: {
            code: code,
            message: message,
            details: details,
        },
    };
    return jsonResponse(error, { status: 400 });
}
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}
// ============================================================================
// Routes
// ============================================================================
function handleRequest(req) {
    return __awaiter(this, void 0, void 0, function () {
        var url, method, headers, worktrees, ralphLoops, hostname, capacity, _a, claudeProcesses, claudeCpuTotal, status_1, worktrees, body, worktree, worktreeId, loops, body, loop, loopId, loop, loopId, loopId, logPath, readFile, logs, _b, error_1, errorMessage;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    url = new URL(req.url);
                    method = req.method;
                    headers = corsHeaders();
                    // Handle OPTIONS preflight
                    if (method === "OPTIONS") {
                        return [2 /*return*/, new Response(null, { headers: headers })];
                    }
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 32, , 33]);
                    if (!(url.pathname === "/api/status" && method === "GET")) return [3 /*break*/, 9];
                    return [4 /*yield*/, gitService.listWorktrees()];
                case 2:
                    worktrees = _d.sent();
                    return [4 /*yield*/, ralphService.listRalphLoops()];
                case 3:
                    ralphLoops = _d.sent();
                    // Update console logger with latest Ralph loops
                    consoleLogger.updateRalphLoops(ralphLoops);
                    return [4 /*yield*/, getHostname()];
                case 4:
                    hostname = _d.sent();
                    return [4 /*yield*/, getCapacity()];
                case 5:
                    capacity = _d.sent();
                    return [4 /*yield*/, getActiveClaudeProcesses()];
                case 6:
                    _a = _d.sent(), claudeProcesses = _a.processes, claudeCpuTotal = _a.totalCpuPercent;
                    _c = {
                        node_id: hostname,
                        hostname: hostname,
                        tailscale_ip: getTailscaleIP(),
                        capacity: __assign(__assign({}, capacity), { claude_cpu_total: Math.round(claudeCpuTotal * 10) / 10, claude_process_count: claudeProcesses.length })
                    };
                    return [4 /*yield*/, getSessions()];
                case 7:
                    _c.sessions = _d.sent();
                    return [4 /*yield*/, getActivePorts()];
                case 8:
                    status_1 = (_c.ports = _d.sent(),
                        _c.worktrees = worktrees,
                        _c.ralph_loops = ralphLoops,
                        _c.console_logs = consoleLogger.getRecentLogs(20),
                        _c.active_claude_processes = claudeProcesses,
                        _c);
                    return [2 /*return*/, jsonResponse(status_1, { headers: headers })];
                case 9:
                    if (!(url.pathname === "/api/worktrees" && method === "GET")) return [3 /*break*/, 11];
                    return [4 /*yield*/, gitService.listWorktrees()];
                case 10:
                    worktrees = _d.sent();
                    return [2 /*return*/, jsonResponse({ worktrees: worktrees }, { headers: headers })];
                case 11:
                    if (!(url.pathname === "/api/worktrees" && method === "POST")) return [3 /*break*/, 14];
                    return [4 /*yield*/, req.json()];
                case 12:
                    body = (_d.sent());
                    if (!body.id || !body.branch) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing required fields: id, branch")];
                    }
                    return [4 /*yield*/, gitService.createWorktree(body)];
                case 13:
                    worktree = _d.sent();
                    return [2 /*return*/, jsonResponse({ worktree: worktree }, { headers: headers })];
                case 14:
                    if (!(url.pathname.startsWith("/api/worktrees/") && method === "DELETE")) return [3 /*break*/, 17];
                    worktreeId = url.pathname.split("/").pop();
                    if (!worktreeId) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing worktree ID")];
                    }
                    return [4 /*yield*/, ralphService.stopRalphLoop(worktreeId).catch(function () {
                            // Ignore if no loop was running
                        })];
                case 15:
                    _d.sent();
                    return [4 /*yield*/, gitService.removeWorktree(worktreeId)];
                case 16:
                    _d.sent();
                    return [2 /*return*/, jsonResponse({ success: true }, { headers: headers })];
                case 17:
                    if (!(url.pathname === "/api/ralph-loops" && method === "GET")) return [3 /*break*/, 19];
                    return [4 /*yield*/, ralphService.listRalphLoops()];
                case 18:
                    loops = _d.sent();
                    return [2 /*return*/, jsonResponse({ loops: loops }, { headers: headers })];
                case 19:
                    if (!(url.pathname === "/api/ralph-loops" && method === "POST")) return [3 /*break*/, 22];
                    return [4 /*yield*/, req.json()];
                case 20:
                    body = (_d.sent());
                    if (!body.worktree_id || !body.prompt) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing required fields: worktree_id, prompt")];
                    }
                    return [4 /*yield*/, ralphService.startRalphLoop(body)];
                case 21:
                    loop = _d.sent();
                    return [2 /*return*/, jsonResponse({ loop: loop }, { headers: headers })];
                case 22:
                    if (!(url.pathname.startsWith("/api/ralph-loops/") && method === "GET")) return [3 /*break*/, 24];
                    loopId = url.pathname.split("/").pop();
                    if (!loopId) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing loop ID")];
                    }
                    return [4 /*yield*/, ralphService.getRalphLoop(loopId)];
                case 23:
                    loop = _d.sent();
                    if (!loop) {
                        return [2 /*return*/, errorResponse("RALPH_LOOP_NOT_FOUND", "Ralph loop not found")];
                    }
                    return [2 /*return*/, jsonResponse({ loop: loop }, { headers: headers })];
                case 24:
                    if (!(url.pathname.startsWith("/api/ralph-loops/") && method === "DELETE")) return [3 /*break*/, 26];
                    loopId = url.pathname.split("/").pop();
                    if (!loopId) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing loop ID")];
                    }
                    return [4 /*yield*/, ralphService.stopRalphLoop(loopId)];
                case 25:
                    _d.sent();
                    return [2 /*return*/, jsonResponse({ success: true }, { headers: headers })];
                case 26:
                    if (!(url.pathname.match(/\/api\/ralph-loops\/[^/]+\/logs$/) && method === "GET")) return [3 /*break*/, 31];
                    loopId = url.pathname.split("/")[3];
                    if (!loopId) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing loop ID")];
                    }
                    logPath = "".concat(process.env.HOME, "/.node-agent/logs/").concat(loopId, ".log");
                    _d.label = 27;
                case 27:
                    _d.trys.push([27, 30, , 31]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("fs/promises"); })];
                case 28:
                    readFile = (_d.sent()).readFile;
                    return [4 /*yield*/, readFile(logPath, "utf-8")];
                case 29:
                    logs = _d.sent();
                    return [2 /*return*/, jsonResponse({ logs: logs }, { headers: headers })];
                case 30:
                    _b = _d.sent();
                    return [2 /*return*/, jsonResponse({ logs: "" }, { headers: headers })];
                case 31: 
                // ========================================================================
                // 404 Not Found
                // ========================================================================
                return [2 /*return*/, jsonResponse({
                        error: {
                            code: "NOT_FOUND",
                            message: "Endpoint not found",
                        },
                    }, { status: 404, headers: headers })];
                case 32:
                    error_1 = _d.sent();
                    console.error("Request error:", error_1);
                    errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                    if (errorMessage.includes("WORKTREE_NOT_FOUND")) {
                        return [2 /*return*/, errorResponse("WORKTREE_NOT_FOUND", "Worktree not found")];
                    }
                    if (errorMessage.includes("WORKTREE_ALREADY_EXISTS")) {
                        return [2 /*return*/, errorResponse("WORKTREE_ALREADY_EXISTS", "Worktree already exists")];
                    }
                    if (errorMessage.includes("RALPH_LOOP_ALREADY_RUNNING")) {
                        return [2 /*return*/, errorResponse("RALPH_LOOP_ALREADY_RUNNING", "Ralph loop already running in this worktree")];
                    }
                    if (errorMessage.includes("RALPH_LOOP_NOT_FOUND")) {
                        return [2 /*return*/, errorResponse("RALPH_LOOP_NOT_FOUND", "Ralph loop not found")];
                    }
                    if (errorMessage.includes("PROCESS_START_FAILED")) {
                        return [2 /*return*/, errorResponse("PROCESS_START_FAILED", "Failed to start Claude Code process")];
                    }
                    if (errorMessage.includes("GIT_OPERATION_FAILED")) {
                        return [2 /*return*/, errorResponse("GIT_OPERATION_FAILED", "Git operation failed")];
                    }
                    return [2 /*return*/, errorResponse("INTERNAL_ERROR", "An internal error occurred", {
                            error: errorMessage,
                        })];
                case 33: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Utility Functions
// ============================================================================
function getHostname() {
    return __awaiter(this, void 0, void 0, function () {
        var exec, promisify, execAsync, stdout, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("child_process"); })];
                case 1:
                    exec = (_b.sent()).exec;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("util"); })];
                case 2:
                    promisify = (_b.sent()).promisify;
                    execAsync = promisify(exec);
                    return [4 /*yield*/, execAsync("hostname")];
                case 3:
                    stdout = (_b.sent()).stdout;
                    return [2 /*return*/, stdout.trim() || "unknown"];
                case 4:
                    _a = _b.sent();
                    return [2 /*return*/, "unknown"];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function getCapacity() {
    return __awaiter(this, void 0, void 0, function () {
        var exec, promisify, execAsync, cpuTop, cpuUsage, memInfo, memUsage, diskInfo, diskUsage, procCount, processes, loadAverage, loadAvg, loadStr, loads, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 11, , 12]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("child_process"); })];
                case 1:
                    exec = (_c.sent()).exec;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("util"); })];
                case 2:
                    promisify = (_c.sent()).promisify;
                    execAsync = promisify(exec);
                    return [4 /*yield*/, execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'")];
                case 3:
                    cpuTop = (_c.sent()).stdout;
                    cpuUsage = parseFloat(cpuTop) || 0;
                    return [4 /*yield*/, execAsync("free | grep Mem | awk '{print ($3/$2) * 100}'")];
                case 4:
                    memInfo = (_c.sent()).stdout;
                    memUsage = parseFloat(memInfo) || 0;
                    return [4 /*yield*/, execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'")];
                case 5:
                    diskInfo = (_c.sent()).stdout;
                    diskUsage = parseInt(diskInfo) || 0;
                    return [4 /*yield*/, execAsync("ps -e | wc -l")];
                case 6:
                    procCount = (_c.sent()).stdout;
                    processes = parseInt(procCount.trim()) || 0;
                    loadAverage = [0, 0, 0];
                    _c.label = 7;
                case 7:
                    _c.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, execAsync("uptime | awk -F'load averages?:' '{print $2}'")];
                case 8:
                    loadAvg = (_c.sent()).stdout;
                    loadStr = loadAvg.trim();
                    loads = loadStr.replace(/,/g, ' ').split(/\s+/).filter(function (v) { return v.length > 0; });
                    loadAverage = loads.slice(0, 3).map(function (v) { return parseFloat(v) || 0; });
                    // Fill missing values if fewer than 3
                    while (loadAverage.length < 3) {
                        loadAverage.push(loadAverage[loadAverage.length - 1] || 0);
                    }
                    return [3 /*break*/, 10];
                case 9:
                    _a = _c.sent();
                    loadAverage = [0, 0, 0];
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/, {
                        cpu_percent: Math.round(cpuUsage),
                        memory_percent: Math.round(memUsage),
                        disk_percent: diskUsage,
                        processes: processes,
                        load_average: loadAverage,
                    }];
                case 11:
                    _b = _c.sent();
                    return [2 /*return*/, {
                            cpu_percent: 0,
                            memory_percent: 0,
                            disk_percent: 0,
                            processes: 0,
                            load_average: [0, 0, 0],
                        }];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function getTailscaleIP() {
    try {
        var execSync = require("child_process").execSync;
        var ip = execSync("tailscale status --json | jq -r '.Self.TailscaleIPs[0]'", {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        return ip || "unknown";
    }
    catch (_a) {
        return "unknown";
    }
}
function getActiveClaudeProcesses() {
    return __awaiter(this, void 0, void 0, function () {
        var exec, promisify, execAsync, psOutput, lines, processes, totalCpuPercent, pidDir, pidToLoopId, _a, readdirSync, readFileSync, files, _i, files_1, file, loopId, pid, _b, _c, lines_1, line, parts, pidStr, cpuStr, memStr, cmdParts, pid, cpuPercent, memoryPercent, command, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("child_process"); })];
                case 1:
                    exec = (_e.sent()).exec;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("util"); })];
                case 2:
                    promisify = (_e.sent()).promisify;
                    execAsync = promisify(exec);
                    return [4 /*yield*/, execAsync('ps aux | grep -E "[c]laude|[d]oppler.*claude" | awk \'{print $2, $3, $4, $11, $12, $13, $14, $15}\'')];
                case 3:
                    psOutput = (_e.sent()).stdout;
                    lines = psOutput.trim().split('\n').filter(function (l) { return l.trim(); });
                    processes = [];
                    totalCpuPercent = 0;
                    pidDir = '/root/.node-agent/pids';
                    pidToLoopId = {};
                    _e.label = 4;
                case 4:
                    _e.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
                case 5:
                    _a = _e.sent(), readdirSync = _a.readdirSync, readFileSync = _a.readFileSync;
                    files = readdirSync(pidDir).filter(function (f) { return f.endsWith('.pid'); });
                    for (_i = 0, files_1 = files; _i < files_1.length; _i++) {
                        file = files_1[_i];
                        loopId = file.replace('.pid', '');
                        try {
                            pid = parseInt(readFileSync("".concat(pidDir, "/").concat(file), 'utf-8').trim());
                            if (!isNaN(pid)) {
                                pidToLoopId[pid] = loopId;
                            }
                        }
                        catch (_f) {
                            // Ignore individual file read errors
                        }
                    }
                    return [3 /*break*/, 7];
                case 6:
                    _b = _e.sent();
                    return [3 /*break*/, 7];
                case 7:
                    for (_c = 0, lines_1 = lines; _c < lines_1.length; _c++) {
                        line = lines_1[_c];
                        parts = line.trim().split(/\s+/);
                        if (parts.length < 4)
                            continue;
                        pidStr = parts[0], cpuStr = parts[1], memStr = parts[2], cmdParts = parts.slice(3);
                        pid = parseInt(pidStr);
                        cpuPercent = parseFloat(cpuStr) || 0;
                        memoryPercent = parseFloat(memStr) || 0;
                        command = cmdParts.join(' ').substring(0, 200);
                        if (!isNaN(pid)) {
                            processes.push({
                                pid: pid,
                                loopId: pidToLoopId[pid],
                                startTime: new Date(), // We could fetch actual start time from ps if needed
                                command: command,
                                cpuPercent: cpuPercent,
                                memoryPercent: memoryPercent,
                            });
                            totalCpuPercent += cpuPercent;
                        }
                    }
                    return [2 /*return*/, { processes: processes, totalCpuPercent: totalCpuPercent }];
                case 8:
                    _d = _e.sent();
                    return [2 /*return*/, { processes: [], totalCpuPercent: 0 }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function getSessions() {
    return __awaiter(this, void 0, void 0, function () {
        var exec, promisify, execAsync, ssh, sshOutput, _a, tmux, tmuxOutput, _b, claudeCode, claudeOutput, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 15, , 16]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("child_process"); })];
                case 1:
                    exec = (_e.sent()).exec;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("util"); })];
                case 2:
                    promisify = (_e.sent()).promisify;
                    execAsync = promisify(exec);
                    ssh = 0;
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, execAsync("who 2>/dev/null | wc -l")];
                case 4:
                    sshOutput = (_e.sent()).stdout;
                    ssh = parseInt(sshOutput.trim()) || 0;
                    return [3 /*break*/, 6];
                case 5:
                    _a = _e.sent();
                    ssh = 0;
                    return [3 /*break*/, 6];
                case 6:
                    tmux = 0;
                    _e.label = 7;
                case 7:
                    _e.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, execAsync("tmux list-sessions 2>/dev/null | wc -l")];
                case 8:
                    tmuxOutput = (_e.sent()).stdout;
                    tmux = parseInt(tmuxOutput.trim()) || 0;
                    return [3 /*break*/, 10];
                case 9:
                    _b = _e.sent();
                    tmux = 0;
                    return [3 /*break*/, 10];
                case 10:
                    claudeCode = 0;
                    _e.label = 11;
                case 11:
                    _e.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, execAsync("ps aux | grep -c '[c]laude' || echo 0")];
                case 12:
                    claudeOutput = (_e.sent()).stdout;
                    claudeCode = parseInt(claudeOutput.trim()) || 0;
                    return [3 /*break*/, 14];
                case 13:
                    _c = _e.sent();
                    claudeCode = 0;
                    return [3 /*break*/, 14];
                case 14: return [2 /*return*/, {
                        ssh: ssh,
                        tmux: tmux,
                        claude_code: claudeCode,
                        total: ssh + tmux + claudeCode,
                    }];
                case 15:
                    _d = _e.sent();
                    return [2 /*return*/, {
                            ssh: 0,
                            tmux: 0,
                            claude_code: 0,
                            total: 0,
                        }];
                case 16: return [2 /*return*/];
            }
        });
    });
}
function getActivePorts() {
    return __awaiter(this, void 0, void 0, function () {
        var exec, promisify, execAsync, ports, isMac, command, portOutput, lines, _i, lines_2, line, parts, portMatch, port, process_1, pidMatch, pid, portMatch, port, process_2, pidMatch, pid, _a, netOutput, lines, _loop_1, _b, lines_3, line, _c, _d;
        var _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    _j.trys.push([0, 11, , 12]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("child_process"); })];
                case 1:
                    exec = (_j.sent()).exec;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("util"); })];
                case 2:
                    promisify = (_j.sent()).promisify;
                    execAsync = promisify(exec);
                    ports = [];
                    _j.label = 3;
                case 3:
                    _j.trys.push([3, 5, , 10]);
                    isMac = process.platform === "darwin";
                    command = "";
                    if (isMac) {
                        // macOS: use lsof (format: PROCESS_NAME PID USER ... TCP ADDRESS:PORT)
                        // awk extracts: PORT ($9), PROCESS_NAME ($1), PID ($2)
                        command = "lsof -i -P -n 2>/dev/null | grep LISTEN | awk '{print $9, $1, $2}'";
                    }
                    else {
                        // Linux: use ss (faster than netstat)
                        command = "ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $5, $7}'";
                    }
                    return [4 /*yield*/, execAsync(command)];
                case 4:
                    portOutput = (_j.sent()).stdout;
                    lines = portOutput.trim().split("\n").filter(function (l) { return l.length > 0; });
                    for (_i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                        line = lines_2[_i];
                        parts = line.trim().split(/\s+/);
                        if (isMac) {
                            portMatch = (_e = parts[0]) === null || _e === void 0 ? void 0 : _e.match(/]:(\d+)|:(\d+)$/);
                            if (portMatch) {
                                port = parseInt(portMatch[1] || portMatch[2]);
                                process_1 = parts[1] || "unknown";
                                pidMatch = (_f = parts[2]) === null || _f === void 0 ? void 0 : _f.match(/^(\d+)/);
                                pid = pidMatch ? parseInt(pidMatch[1]) : undefined;
                                ports.push({
                                    port: port,
                                    protocol: "tcp",
                                    state: "listening",
                                    process: process_1,
                                    pid: pid
                                });
                            }
                        }
                        else {
                            portMatch = (_g = parts[0]) === null || _g === void 0 ? void 0 : _g.match(/]:(\d+)|:(\d+)$/);
                            if (portMatch) {
                                port = parseInt(portMatch[1] || portMatch[2]);
                                process_2 = parts[1] || "unknown";
                                pidMatch = (_h = parts[2]) === null || _h === void 0 ? void 0 : _h.match(/pid=(\d+)/);
                                pid = pidMatch ? parseInt(pidMatch[1]) : undefined;
                                ports.push({
                                    port: port,
                                    protocol: "tcp",
                                    state: "listening",
                                    process: process_2,
                                    pid: pid
                                });
                            }
                        }
                    }
                    return [3 /*break*/, 10];
                case 5:
                    _a = _j.sent();
                    _j.label = 6;
                case 6:
                    _j.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, execAsync("netstat -an 2>/dev/null | grep LISTEN | grep -E ':(80|443|8000|8080|8443|8911|9000|3000|5000|4000|7000)'")];
                case 7:
                    netOutput = (_j.sent()).stdout;
                    lines = netOutput.trim().split("\n").filter(function (l) { return l.length > 0; });
                    _loop_1 = function (line) {
                        // netstat format varies, but typically: proto addr state
                        var parts = line.trim().split(/\s+/);
                        var addr = parts[3] || "";
                        var portMatch = addr.match(/\.(\d+)\./);
                        if (portMatch) {
                            var port_1 = parseInt(portMatch[1]);
                            if (port_1 > 0 && !ports.find(function (p) { return p.port === port_1; })) {
                                ports.push({
                                    port: port_1,
                                    protocol: addr.includes(".") ? "tcp" : "udp",
                                    state: "listening"
                                });
                            }
                        }
                    };
                    for (_b = 0, lines_3 = lines; _b < lines_3.length; _b++) {
                        line = lines_3[_b];
                        _loop_1(line);
                    }
                    return [3 /*break*/, 9];
                case 8:
                    _c = _j.sent();
                    // If all else fails, return empty array
                    ports = [];
                    return [3 /*break*/, 9];
                case 9: return [3 /*break*/, 10];
                case 10:
                    // Sort by port number
                    ports.sort(function (a, b) { return a.port - b.port; });
                    return [2 /*return*/, ports];
                case 11:
                    _d = _j.sent();
                    return [2 /*return*/, []];
                case 12: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Server
// ============================================================================
console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551                                                                   \u2551\n\u2551   \u2588\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557    \u2588\u2588\u2557    \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557   \u2588\u2588\u2557         \u2551\n\u2551   \u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551    \u2588\u2588\u2551    \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551   \u2588\u2588\u2551         \u2551\n\u2551   \u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551 \u2588\u2557 \u2588\u2588\u2551    \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2551   \u2588\u2588\u2551         \u2551\n\u2551   \u2588\u2588\u2551\u255A\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2551\u2588\u2588\u2588\u2557\u2588\u2588\u2551    \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D \u255A\u2588\u2588\u2557 \u2588\u2588\u2554\u255D         \u2551\n\u2551   \u2588\u2588\u2551 \u255A\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2554\u2588\u2588\u2588\u2554\u255D    \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u255A\u2588\u2588\u2588\u2588\u2554\u255D          \u2551\n\u2551   \u255A\u2550\u255D  \u255A\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u255D\u255A\u2550\u2550\u255D     \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D  \u255A\u2550\u2550\u2550\u255D           \u2551\n\u2551                                                                   \u2551\n\u2551              Node Agent v0.1.0 - Ralph Loop Orchestration            \u2551\n\u2551                                                                   \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n");
// Track active WebSocket connections and their pipe cleanup
var wsConnections = new Map();
var server = Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch: function (req, server) {
        var url = new URL(req.url);
        var method = req.method;
        // ========================================================================
        // WebSocket Upgrade: /api/ralph-loops/:id/ws
        // ========================================================================
        if (url.pathname.startsWith("/api/ralph-loops/") && url.pathname.endsWith("/ws")) {
            var parts = url.pathname.split("/");
            var loopId = parts[3]; // /api/ralph-loops/:id/ws
            if (!loopId) {
                return new Response("Missing loop ID", { status: 400 });
            }
            // Check if loop exists and has active process
            var proc = ralphService.getProcess(loopId);
            if (!proc) {
                return new Response("Loop not found or not running", { status: 404 });
            }
            // Upgrade to WebSocket
            var upgraded = server.upgrade(req, {
                data: { loopId: loopId },
            });
            if (!upgraded) {
                return new Response("WebSocket upgrade failed", { status: 400 });
            }
            // Return undefined to signal successful upgrade
            return undefined;
        }
        // ========================================================================
        // Regular HTTP requests
        // ========================================================================
        return handleRequest(req);
    },
    websocket: {
        data: {},
        open: function (ws) {
            var loopId = ws.data.loopId;
            console.log("[WebSocket] Connection opened for loop: ".concat(loopId));
            var proc = ralphService.getProcess(loopId);
            if (!proc) {
                ws.close(1008, "Loop process not found");
                return;
            }
            // Pipe Claude stdout → WebSocket
            var stdoutHandler = function (data) {
                try {
                    ws.send(data.toString());
                }
                catch (err) {
                    console.error("[WebSocket] Error sending to client:", err);
                }
            };
            proc.stdout.on("data", stdoutHandler);
            // Store cleanup function
            wsConnections.set(ws.remoteAddress + ":" + loopId, {
                cleanup: function () {
                    proc.stdout.off("data", stdoutHandler);
                },
            });
            // Send welcome message
            ws.send("[WebSocket] Connected to Ralph loop: ".concat(loopId, "\n"));
            ws.send("[WebSocket] Messages sent will be relayed to Claude stdin\n");
            ws.send("[WebSocket] ---\n");
        },
        message: function (ws, message) {
            var loopId = ws.data.loopId;
            var proc = ralphService.getProcess(loopId);
            if (!proc || !proc.stdin) {
                ws.send("[WebSocket] Error: Loop process not available\n");
                return;
            }
            // Relay message to Claude stdin
            try {
                proc.stdin.write(message.toString() + "\n");
                console.log("[WebSocket] Relayed to ".concat(loopId, ": ").concat(message.toString().substring(0, 100)));
            }
            catch (err) {
                ws.send("[WebSocket] Error writing to stdin: ".concat(err, "\n"));
            }
        },
        close: function (ws, code, reason) {
            var loopId = ws.data.loopId;
            console.log("[WebSocket] Connection closed for loop: ".concat(loopId, " (code: ").concat(code, ", reason: ").concat(reason, ")"));
            // Cleanup pipes
            var connection = wsConnections.get(ws.remoteAddress + ":" + loopId);
            if (connection) {
                connection.cleanup();
                wsConnections.delete(ws.remoteAddress + ":" + loopId);
            }
        },
        drain: function (ws) {
            // WebSocket is ready to receive more data
            // Could implement backpressure handling here if needed
        },
        error: function (ws, error) {
            console.error("[WebSocket] Error for loop ".concat(ws.data.loopId, ":"), error);
        },
    },
});
console.log("\uD83D\uDE80 Node Agent listening on http://".concat(HOST, ":").concat(PORT));
console.log("\uD83D\uDCE1 API Endpoints:");
console.log("   GET    /api/status");
console.log("   GET    /api/worktrees");
console.log("   POST   /api/worktrees");
console.log("   DELETE /api/worktrees/:id");
console.log("   GET    /api/ralph-loops");
console.log("   POST   /api/ralph-loops");
console.log("   GET    /api/ralph-loops/:id");
console.log("   DELETE /api/ralph-loops/:id");
console.log("   GET    /api/ralph-loops/:id/logs");
console.log("   WS     /api/ralph-loops/:id/ws  (NEW - WebSocket oversight)");
console.log();
// Start enhanced console logging if enabled
if (CONSOLE_LOGGING_ENABLED) {
    consoleLogger.startLogging();
}
else {
    console.log("📊 Console logging disabled (set CONSOLE_LOGGING_ENABLED=true to enable)");
    console.log();
}
// ============================================================================
// PM Daemon Startup (Conditional)
// ============================================================================
var PM_DAEMON_ENABLED = process.env.PM_DAEMON_ENABLED === "true";
if (PM_DAEMON_ENABLED) {
    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551                                                                   \u2551\n\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557            \u2551\n\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D            \u2551\n\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557              \u2551\n\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u255A\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D              \u2551\n\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551 \u255A\u2550\u255D \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557            \u2551\n\u2551   \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D     \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D            \u2551\n\u2551                                                                   \u2551\n\u2551              PM Daemon - Telegram-Connected Orchestrator          \u2551\n\u2551                                                                   \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n");
    // Check for required environment variables
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error("❌ PM_DAEMON_ENABLED is true, but TELEGRAM_BOT_TOKEN is not set");
        console.error("   Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Doppler or .env");
        process.exit(1);
    }
    if (!process.env.TELEGRAM_CHAT_ID) {
        console.error("❌ PM_DAEMON_ENABLED is true, but TELEGRAM_CHAT_ID is not set");
        console.error("   Please set TELEGRAM_CHAT_ID in Doppler or .env");
        process.exit(1);
    }
    // Initialize PM Daemon services
    startPmDaemon();
}
/**
 * Start the PM Daemon services
 */
function startPmDaemon() {
    return __awaiter(this, void 0, void 0, function () {
        var telegramService_1, pmCommands_1, daemonLayerAgent_1, pmMonitor_1, testResult, localHostname, recentEvents_1, MAX_RECENT_EVENTS_1, telegramAbortController_1, monitorAbortController_1, shutdown, error_2;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    telegramService_1 = new telegram_1.TelegramService();
                    pmCommands_1 = new pm_commands_1.PmCommandsService();
                    daemonLayerAgent_1 = new daemon_layer_agent_1.DaemonLayerAgentService();
                    pmMonitor_1 = new pm_monitor_1.PmMonitorService({
                        intervalMs: parseInt(process.env.PM_MONITOR_INTERVAL_MS || "30000", 10),
                        stallThresholdMinutes: parseInt(process.env.PM_STALL_THRESHOLD_MINUTES || "10", 10),
                    });
                    // Test Telegram connection
                    console.log("[PM Daemon] Testing Telegram connection...");
                    return [4 /*yield*/, telegramService_1.testConnection()];
                case 1:
                    testResult = _b.sent();
                    if (!testResult.ok) {
                        console.error("[PM Daemon] Failed to connect to Telegram: ".concat(testResult.error));
                        throw new Error("Telegram connection failed: ".concat(testResult.error));
                    }
                    console.log("[PM Daemon] \u2713 Connected to Telegram bot: @".concat((_a = testResult.bot) === null || _a === void 0 ? void 0 : _a.username));
                    // Start Daemon Layer Agent session (persistent conversation memory)
                    console.log("[PM Daemon] Starting Daemon Layer Agent session...");
                    return [4 /*yield*/, daemonLayerAgent_1.start()];
                case 2:
                    _b.sent();
                    console.log("[PM Daemon] \u2713 Daemon Layer Agent session running");
                    return [4 /*yield*/, getHostname()];
                case 3:
                    localHostname = _b.sent();
                    // Send startup notification
                    return [4 /*yield*/, telegramService_1.sendText("\uD83D\uDFE2 *PM Daemon Online*\n\nNode: ".concat(localHostname, "\nMode: Single-node (local)\nTime: ").concat(new Date().toISOString(), "\n"))];
                case 4:
                    // Send startup notification
                    _b.sent();
                    recentEvents_1 = [];
                    MAX_RECENT_EVENTS_1 = 10;
                    // Start Telegram polling loop
                    console.log("[PM Daemon] Starting Telegram polling loop...");
                    telegramAbortController_1 = new AbortController();
                    telegramService_1.startPolling({
                        signal: telegramAbortController_1.signal,
                        onUpdate: function (update) { return __awaiter(_this, void 0, void 0, function () {
                            var command, response, agentResponse;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!update.message) {
                                            return [2 /*return*/];
                                        }
                                        command = telegramService_1.parseCommand(update.message);
                                        if (!command) {
                                            return [2 /*return*/];
                                        }
                                        console.log("[PM Daemon] Received command: /".concat(command.command));
                                        if (!(command.command !== "chat")) return [3 /*break*/, 3];
                                        return [4 /*yield*/, pmCommands_1.executeCommand(command)];
                                    case 1:
                                        response = _a.sent();
                                        return [4 /*yield*/, telegramService_1.sendText(response.text, {
                                                parse_mode: response.parse_mode,
                                                reply_to_message_id: response.reply_to_message_id,
                                            })];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                    case 3: return [4 /*yield*/, daemonLayerAgent_1.processMessage(command.raw_text, {
                                            events: recentEvents_1.slice(-5),
                                        })];
                                    case 4:
                                        agentResponse = _a.sent();
                                        return [4 /*yield*/, telegramService_1.sendText(agentResponse.text)];
                                    case 5:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); },
                        onError: function (error) {
                            console.error("[PM Daemon] Telegram polling error:", error);
                        },
                    });
                    // Start monitor loop
                    console.log("[PM Daemon] Starting monitor loop...");
                    monitorAbortController_1 = new AbortController();
                    pmMonitor_1.startMonitoring({
                        signal: monitorAbortController_1.signal,
                        onEvent: function (event) { return __awaiter(_this, void 0, void 0, function () {
                            var message, warnings;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        // Add to recent events
                                        recentEvents_1.push(event);
                                        if (recentEvents_1.length > MAX_RECENT_EVENTS_1) {
                                            recentEvents_1.shift();
                                        }
                                        if (!(event.priority === "high" || event.priority === "critical")) return [3 /*break*/, 2];
                                        message = "";
                                        switch (event.type) {
                                            case "ralph_stalled":
                                                message = "\u26A0\uFE0F *Ralph Stalled*\n\n`".concat(event.data.loop_id, "` on ").concat(event.node_id, "\nStuck at iteration ").concat(event.data.iteration, " for ").concat(event.data.stall_duration_minutes, " minutes\n\nLast activity: ").concat(event.data.last_activity, "\n");
                                                break;
                                            case "ralph_errored":
                                                message = "\u274C *Ralph Error*\n\n`".concat(event.data.loop_id, "` on ").concat(event.node_id, "\nIteration: ").concat(event.data.iteration, "\n\nError: ").concat(event.data.error_message, "\n");
                                                break;
                                            case "ralph_completed":
                                                message = "\u2705 *Ralph Completed*\n\n`".concat(event.data.loop_id, "` on ").concat(event.node_id, "\nIterations: ").concat(event.data.total_iterations, "\nCommits: ").concat(event.data.total_commits, "\nDuration: ").concat(Math.floor(event.data.duration_seconds / 60), "m\n");
                                                break;
                                            case "node_high_resources":
                                                warnings = event.data.warnings;
                                                message = "\uD83D\uDCCA *High Resource Usage*\n\n".concat(event.node_id, ": ").concat(warnings.join(", "), "\n");
                                                break;
                                            default:
                                                // For other events, let the PM brain decide whether to notify
                                                return [2 /*return*/];
                                        }
                                        return [4 /*yield*/, telegramService_1.sendText(message)];
                                    case 1:
                                        _a.sent();
                                        _a.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        }); },
                    });
                    console.log("[PM Daemon] ✓ All PM Daemon services started");
                    console.log("[PM Daemon] 📱 Send /help to the bot for available commands");
                    shutdown = function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log("[PM Daemon] Shutting down...");
                                    telegramAbortController_1.abort();
                                    monitorAbortController_1.abort();
                                    telegramService_1.stopPolling();
                                    pmMonitor_1.stopMonitoring();
                                    // Stop Daemon Layer Agent session
                                    console.log("[PM Daemon] Stopping Daemon Layer Agent session...");
                                    return [4 /*yield*/, daemonLayerAgent_1.stop()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, telegramService_1.sendText("🔴 PM Daemon shutting down")];
                                case 2:
                                    _a.sent();
                                    // Allow time for message to send
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                                case 3:
                                    // Allow time for message to send
                                    _a.sent();
                                    process.exit(0);
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    process.on("SIGINT", shutdown);
                    process.on("SIGTERM", shutdown);
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _b.sent();
                    console.error("[PM Daemon] Failed to start:", error_2);
                    process.exit(1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
