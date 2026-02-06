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
// Configuration
var PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);
var HOST = process.env.NODE_AGENT_HOST || "0.0.0.0";
// Services
var gitService = new git_1.GitService();
var ralphService = new ralph_1.RalphService();
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
        var url, method, headers, worktrees, ralphLoops, hostname, status_1, worktrees, body, worktree, worktreeId, loops, body, loop, loopId, loop, loopId, loopId, logPath, readFile, logs, _a, error_1, errorMessage;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    url = new URL(req.url);
                    method = req.method;
                    headers = corsHeaders();
                    // Handle OPTIONS preflight
                    if (method === "OPTIONS") {
                        return [2 /*return*/, new Response(null, { headers: headers })];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 31, , 32]);
                    if (!(url.pathname === "/api/status" && method === "GET")) return [3 /*break*/, 8];
                    return [4 /*yield*/, gitService.listWorktrees()];
                case 2:
                    worktrees = _c.sent();
                    return [4 /*yield*/, ralphService.listRalphLoops()];
                case 3:
                    ralphLoops = _c.sent();
                    return [4 /*yield*/, getHostname()];
                case 4:
                    hostname = _c.sent();
                    _b = {
                        node_id: hostname,
                        hostname: hostname,
                        tailscale_ip: getTailscaleIP()
                    };
                    return [4 /*yield*/, getCapacity()];
                case 5:
                    _b.capacity = _c.sent();
                    return [4 /*yield*/, getSessions()];
                case 6:
                    _b.sessions = _c.sent();
                    return [4 /*yield*/, getActivePorts()];
                case 7:
                    status_1 = (_b.ports = _c.sent(),
                        _b.worktrees = worktrees,
                        _b.ralph_loops = ralphLoops,
                        _b);
                    return [2 /*return*/, jsonResponse(status_1, { headers: headers })];
                case 8:
                    if (!(url.pathname === "/api/worktrees" && method === "GET")) return [3 /*break*/, 10];
                    return [4 /*yield*/, gitService.listWorktrees()];
                case 9:
                    worktrees = _c.sent();
                    return [2 /*return*/, jsonResponse({ worktrees: worktrees }, { headers: headers })];
                case 10:
                    if (!(url.pathname === "/api/worktrees" && method === "POST")) return [3 /*break*/, 13];
                    return [4 /*yield*/, req.json()];
                case 11:
                    body = (_c.sent());
                    if (!body.id || !body.branch) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing required fields: id, branch")];
                    }
                    return [4 /*yield*/, gitService.createWorktree(body)];
                case 12:
                    worktree = _c.sent();
                    return [2 /*return*/, jsonResponse({ worktree: worktree }, { headers: headers })];
                case 13:
                    if (!(url.pathname.startsWith("/api/worktrees/") && method === "DELETE")) return [3 /*break*/, 16];
                    worktreeId = url.pathname.split("/").pop();
                    if (!worktreeId) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing worktree ID")];
                    }
                    return [4 /*yield*/, ralphService.stopRalphLoop(worktreeId).catch(function () {
                            // Ignore if no loop was running
                        })];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, gitService.removeWorktree(worktreeId)];
                case 15:
                    _c.sent();
                    return [2 /*return*/, jsonResponse({ success: true }, { headers: headers })];
                case 16:
                    if (!(url.pathname === "/api/ralph-loops" && method === "GET")) return [3 /*break*/, 18];
                    return [4 /*yield*/, ralphService.listRalphLoops()];
                case 17:
                    loops = _c.sent();
                    return [2 /*return*/, jsonResponse({ loops: loops }, { headers: headers })];
                case 18:
                    if (!(url.pathname === "/api/ralph-loops" && method === "POST")) return [3 /*break*/, 21];
                    return [4 /*yield*/, req.json()];
                case 19:
                    body = (_c.sent());
                    if (!body.worktree_id || !body.prompt) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing required fields: worktree_id, prompt")];
                    }
                    return [4 /*yield*/, ralphService.startRalphLoop(body)];
                case 20:
                    loop = _c.sent();
                    return [2 /*return*/, jsonResponse({ loop: loop }, { headers: headers })];
                case 21:
                    if (!(url.pathname.startsWith("/api/ralph-loops/") && method === "GET")) return [3 /*break*/, 23];
                    loopId = url.pathname.split("/").pop();
                    if (!loopId) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing loop ID")];
                    }
                    return [4 /*yield*/, ralphService.getRalphLoop(loopId)];
                case 22:
                    loop = _c.sent();
                    if (!loop) {
                        return [2 /*return*/, errorResponse("RALPH_LOOP_NOT_FOUND", "Ralph loop not found")];
                    }
                    return [2 /*return*/, jsonResponse({ loop: loop }, { headers: headers })];
                case 23:
                    if (!(url.pathname.startsWith("/api/ralph-loops/") && method === "DELETE")) return [3 /*break*/, 25];
                    loopId = url.pathname.split("/").pop();
                    if (!loopId) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing loop ID")];
                    }
                    return [4 /*yield*/, ralphService.stopRalphLoop(loopId)];
                case 24:
                    _c.sent();
                    return [2 /*return*/, jsonResponse({ success: true }, { headers: headers })];
                case 25:
                    if (!(url.pathname.match(/\/api\/ralph-loops\/[^/]+\/logs$/) && method === "GET")) return [3 /*break*/, 30];
                    loopId = url.pathname.split("/")[3];
                    if (!loopId) {
                        return [2 /*return*/, errorResponse("INVALID_REQUEST", "Missing loop ID")];
                    }
                    logPath = "".concat(process.env.HOME, "/.node-agent/logs/").concat(loopId, ".log");
                    _c.label = 26;
                case 26:
                    _c.trys.push([26, 29, , 30]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("fs/promises"); })];
                case 27:
                    readFile = (_c.sent()).readFile;
                    return [4 /*yield*/, readFile(logPath, "utf-8")];
                case 28:
                    logs = _c.sent();
                    return [2 /*return*/, jsonResponse({ logs: logs }, { headers: headers })];
                case 29:
                    _a = _c.sent();
                    return [2 /*return*/, jsonResponse({ logs: "" }, { headers: headers })];
                case 30: 
                // ========================================================================
                // 404 Not Found
                // ========================================================================
                return [2 /*return*/, jsonResponse({
                        error: {
                            code: "NOT_FOUND",
                            message: "Endpoint not found",
                        },
                    }, { status: 404, headers: headers })];
                case 31:
                    error_1 = _c.sent();
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
                case 32: return [2 /*return*/];
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
        var exec, promisify, execAsync, ports, isMac, command, portOutput, lines, _i, lines_1, line, parts, portMatch, port, process_1, pidMatch, pid, portMatch, port, process_2, pidMatch, pid, _a, netOutput, lines, _loop_1, _b, lines_2, line, _c, _d;
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
                    for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                        line = lines_1[_i];
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
                    for (_b = 0, lines_2 = lines; _b < lines_2.length; _b++) {
                        line = lines_2[_b];
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
var server = Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch: handleRequest,
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
console.log();
