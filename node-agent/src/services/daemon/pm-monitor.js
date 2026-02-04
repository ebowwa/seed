"use strict";
// PM Monitor Service
// Monitor loop - polls local node, detects state changes, feeds events to PM brain
// Events: Ralph completions, errors, stalls, resource warnings
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
exports.PmMonitorService = void 0;
var DEFAULT_CONFIG = {
    intervalMs: 30000, // 30 seconds
    stallThresholdMinutes: 10,
    milestoneIntervals: [10, 25, 50, 100],
    resourceThresholds: {
        cpu_percent: 90,
        memory_percent: 85,
        disk_percent: 90,
    },
};
var LOCALHOST = "127.0.0.1";
var API_PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);
var PmMonitorService = /** @class */ (function () {
    function PmMonitorService(config) {
        this.loopSnapshots = new Map();
        this.monitorInterval = null;
        this.isRunning = false;
        this.localNodeId = "localhost";
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
    }
    /**
     * Start the monitor loop
     */
    PmMonitorService.prototype.startMonitoring = function () {
        return __awaiter(this, arguments, void 0, function (options) {
            var initialStatus;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isRunning) {
                            console.warn("[PmMonitor] Monitoring already running");
                            return [2 /*return*/];
                        }
                        this.isRunning = true;
                        console.log("[PmMonitor] Starting monitor loop (interval: ".concat(this.config.intervalMs, "ms)"));
                        return [4 /*yield*/, this.fetchLocalStatus()];
                    case 1:
                        initialStatus = _a.sent();
                        if (initialStatus) {
                            this.localNodeId = initialStatus.node_id;
                        }
                        // Start monitoring loop
                        this.monitorInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                            var error_1;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                                            this.stopMonitoring();
                                            return [2 /*return*/];
                                        }
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, this.monitorCycle(options)];
                                    case 2:
                                        _b.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_1 = _b.sent();
                                        console.error("[PmMonitor] Error in monitor cycle:", error_1);
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); }, this.config.intervalMs);
                        // First cycle immediately
                        return [4 /*yield*/, this.monitorCycle(options)];
                    case 2:
                        // First cycle immediately
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stop the monitor loop
     */
    PmMonitorService.prototype.stopMonitoring = function () {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.isRunning = false;
        console.log("[PmMonitor] Monitoring stopped");
    };
    /**
     * Check if monitoring is running
     */
    PmMonitorService.prototype.isActive = function () {
        return this.isRunning;
    };
    /**
     * Single monitor cycle - check local node for state changes
     */
    PmMonitorService.prototype.monitorCycle = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var status, now, loops, _i, loops_1, loop, previousState, _loop_1, this_1, _a, _b, _c, loopId, previousLoop;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.fetchLocalStatus()];
                    case 1:
                        status = _d.sent();
                        if (!status) {
                            return [2 /*return*/];
                        }
                        now = new Date().toISOString();
                        loops = status.ralph_loops || [];
                        // Check for resource warnings
                        return [4 /*yield*/, this.checkResourceThresholds(status, options)];
                    case 2:
                        // Check for resource warnings
                        _d.sent();
                        _i = 0, loops_1 = loops;
                        _d.label = 3;
                    case 3:
                        if (!(_i < loops_1.length)) return [3 /*break*/, 8];
                        loop = loops_1[_i];
                        previousState = this.loopSnapshots.get(loop.id);
                        if (!!previousState) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.emitEvent({
                                type: "ralph_started",
                                timestamp: now,
                                node_id: this.localNodeId,
                                data: {
                                    loop_id: loop.id,
                                    worktree_id: loop.worktree_id,
                                    prompt: loop.prompt.substring(0, 100) + (loop.prompt.length > 100 ? "..." : ""),
                                    git_info: loop.git_info,
                                },
                                priority: "low",
                            }, options)];
                    case 4:
                        _d.sent();
                        return [3 /*break*/, 7];
                    case 5: 
                    // Check for loop state changes
                    return [4 /*yield*/, this.checkLoopStateChanges(loop, previousState, options)];
                    case 6:
                        // Check for loop state changes
                        _d.sent();
                        _d.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8:
                        _loop_1 = function (loopId, previousLoop) {
                            var currentLoop;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        currentLoop = loops.find(function (l) { return l.id === loopId; });
                                        if (!!currentLoop) return [3 /*break*/, 2];
                                        if (!(previousLoop.status === "running")) return [3 /*break*/, 2];
                                        return [4 /*yield*/, this_1.emitEvent({
                                                type: "ralph_completed",
                                                timestamp: now,
                                                node_id: this_1.localNodeId,
                                                data: {
                                                    loop_id: loopId,
                                                    worktree_id: "",
                                                    total_iterations: previousLoop.iteration,
                                                    total_commits: 0,
                                                    duration_seconds: 0,
                                                },
                                                priority: "medium",
                                            }, options)];
                                    case 1:
                                        _e.sent();
                                        _e.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _a = 0, _b = this.loopSnapshots;
                        _d.label = 9;
                    case 9:
                        if (!(_a < _b.length)) return [3 /*break*/, 12];
                        _c = _b[_a], loopId = _c[0], previousLoop = _c[1];
                        return [5 /*yield**/, _loop_1(loopId, previousLoop)];
                    case 10:
                        _d.sent();
                        _d.label = 11;
                    case 11:
                        _a++;
                        return [3 /*break*/, 9];
                    case 12:
                        // Update snapshots
                        this.updateLoopSnapshots(loops);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check for Ralph loop state changes
     */
    PmMonitorService.prototype.checkLoopStateChanges = function (loop, previousState, options) {
        return __awaiter(this, void 0, void 0, function () {
            var now, nowDate, lastActivityDate, startedAt, durationSeconds, stallThresholdMs, timeSinceActivity, _i, _a, milestone;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        now = new Date().toISOString();
                        nowDate = new Date(now);
                        lastActivityDate = new Date(loop.last_activity || loop.started_at);
                        if (!(previousState.status === "running" && loop.status === "complete")) return [3 /*break*/, 2];
                        startedAt = new Date(loop.started_at);
                        durationSeconds = Math.floor((nowDate.getTime() - startedAt.getTime()) / 1000);
                        return [4 /*yield*/, this.emitEvent({
                                type: "ralph_completed",
                                timestamp: now,
                                node_id: this.localNodeId,
                                data: {
                                    loop_id: loop.id,
                                    worktree_id: loop.worktree_id,
                                    total_iterations: loop.iteration,
                                    total_commits: ((_b = loop.recent_commits) === null || _b === void 0 ? void 0 : _b.length) || 0,
                                    duration_seconds: durationSeconds,
                                },
                                priority: "medium",
                            }, options)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                    case 2:
                        if (!(loop.status === "error")) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.emitEvent({
                                type: "ralph_errored",
                                timestamp: now,
                                node_id: this.localNodeId,
                                data: {
                                    loop_id: loop.id,
                                    worktree_id: loop.worktree_id,
                                    iteration: loop.iteration,
                                    error_message: loop.error_message || "Unknown error",
                                },
                                priority: "high",
                            }, options)];
                    case 3:
                        _c.sent();
                        return [2 /*return*/];
                    case 4:
                        if (!(loop.status === "running")) return [3 /*break*/, 6];
                        stallThresholdMs = this.config.stallThresholdMinutes * 60 * 1000;
                        timeSinceActivity = nowDate.getTime() - lastActivityDate.getTime();
                        if (!(timeSinceActivity > stallThresholdMs)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.emitEvent({
                                type: "ralph_stalled",
                                timestamp: now,
                                node_id: this.localNodeId,
                                data: {
                                    loop_id: loop.id,
                                    worktree_id: loop.worktree_id,
                                    iteration: loop.iteration,
                                    last_activity: loop.last_activity || loop.started_at,
                                    stall_duration_minutes: Math.floor(timeSinceActivity / (60 * 1000)),
                                },
                                priority: "high",
                            }, options)];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6:
                        if (!this.config.milestoneIntervals) return [3 /*break*/, 10];
                        _i = 0, _a = this.config.milestoneIntervals;
                        _c.label = 7;
                    case 7:
                        if (!(_i < _a.length)) return [3 /*break*/, 10];
                        milestone = _a[_i];
                        if (!(loop.iteration === milestone && previousState.iteration < milestone)) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.emitEvent({
                                type: "ralph_milestone",
                                timestamp: now,
                                node_id: this.localNodeId,
                                data: {
                                    loop_id: loop.id,
                                    worktree_id: loop.worktree_id,
                                    iteration: loop.iteration,
                                    milestone: milestone,
                                },
                                priority: "low",
                            }, options)];
                    case 8:
                        _c.sent();
                        _c.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 7];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check resource thresholds
     */
    PmMonitorService.prototype.checkResourceThresholds = function (status, options) {
        return __awaiter(this, void 0, void 0, function () {
            var capacity, thresholds, warnings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.config.resourceThresholds) {
                            return [2 /*return*/];
                        }
                        capacity = status.capacity;
                        thresholds = this.config.resourceThresholds;
                        warnings = [];
                        if (capacity.cpu_percent > thresholds.cpu_percent) {
                            warnings.push("CPU at ".concat(capacity.cpu_percent, "%"));
                        }
                        if (capacity.memory_percent > thresholds.memory_percent) {
                            warnings.push("Memory at ".concat(capacity.memory_percent, "%"));
                        }
                        if (capacity.disk_percent > thresholds.disk_percent) {
                            warnings.push("Disk at ".concat(capacity.disk_percent, "%"));
                        }
                        if (!(warnings.length > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.emitEvent({
                                type: "node_high_resources",
                                timestamp: new Date().toISOString(),
                                node_id: this.localNodeId,
                                data: {
                                    warnings: warnings,
                                    capacity: capacity,
                                },
                                priority: "medium",
                            }, options)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update loop snapshots
     */
    PmMonitorService.prototype.updateLoopSnapshots = function (loops) {
        // Remove snapshots for loops that no longer exist
        var currentLoopIds = new Set(loops.map(function (l) { return l.id; }));
        for (var _i = 0, _a = this.loopSnapshots.keys(); _i < _a.length; _i++) {
            var loopId = _a[_i];
            if (!currentLoopIds.has(loopId)) {
                this.loopSnapshots.delete(loopId);
            }
        }
        // Update or add snapshots for current loops
        for (var _b = 0, loops_2 = loops; _b < loops_2.length; _b++) {
            var loop = loops_2[_b];
            this.loopSnapshots.set(loop.id, {
                id: loop.id,
                status: loop.status,
                iteration: loop.iteration,
                last_activity: loop.last_activity || loop.started_at,
            });
        }
    };
    /**
     * Emit a monitor event
     */
    PmMonitorService.prototype.emitEvent = function (event, options) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!options.onEvent) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, options.onEvent(event)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error("[PmMonitor] Error in event handler:", error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch local node status
     */
    PmMonitorService.prototype.fetchLocalStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("http://".concat(LOCALHOST, ":").concat(API_PORT, "/api/status"), {
                                signal: AbortSignal.timeout(5000),
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
     * Get current loop snapshots
     */
    PmMonitorService.prototype.getSnapshots = function () {
        return new Map(this.loopSnapshots);
    };
    return PmMonitorService;
}());
exports.PmMonitorService = PmMonitorService;
