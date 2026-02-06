#!/usr/bin/env bun
"use strict";
/**
 * Rolling Keys Supervisor - Monitors Claude and handles key rotation on failures
 *
 * This supervisor:
 * - Manages rolling key state (file-based)
 * - Spawns Claude with selected key
 * - Monitors for rate limit errors
 * - Auto-switches keys and retries on failure
 */
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
var child_process_1 = require("child_process");
var fs_1 = require("fs");
var path_1 = require("path");
var STATE_DIR = process.env.HOME + "/.node-agent";
var STATE_FILE = path_1.default.join(STATE_DIR, "rolling-keys-state.json");
/**
 * Load rolling keys state from file
 */
function loadState() {
    return __awaiter(this, void 0, void 0, function () {
        var content, _a, keysArray_1, keys;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs_1.promises.readFile(STATE_FILE, "utf-8")];
                case 1:
                    content = _b.sent();
                    return [2 /*return*/, JSON.parse(content)];
                case 2:
                    _a = _b.sent();
                    keysArray_1 = process.env.ANTHROPIC_API_KEYS;
                    if (!keysArray_1) {
                        throw new Error("ANTHROPIC_API_KEYS not set");
                    }
                    keys = JSON.parse(keysArray_1);
                    return [2 /*return*/, {
                            currentIndex: 0,
                            keyStatus: keys.map(function (_, i) { return ({
                                index: i,
                                lastUsed: 0,
                                failureCount: 0,
                                healthy: true,
                            }); }),
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Save rolling keys state to file
 */
function saveState(state) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fs_1.promises.mkdir(STATE_DIR, { recursive: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, fs_1.promises.writeFile(STATE_FILE, JSON.stringify(state, null, 2))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Get the next available key (round-robin with healthy skip)
 */
function getNextAvailableKey(state) {
    return __awaiter(this, void 0, void 0, function () {
        var keysArray, keys, now, startIndex, i, index, keyStatus;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    keysArray = process.env.ANTHROPIC_API_KEYS;
                    if (!keysArray)
                        return [2 /*return*/, null];
                    keys = JSON.parse(keysArray);
                    now = Date.now();
                    startIndex = state.currentIndex;
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < keys.length)) return [3 /*break*/, 4];
                    index = (startIndex + i) % keys.length;
                    keyStatus = state.keyStatus[index];
                    // Skip if in backoff period
                    if (keyStatus.backoffUntil && keyStatus.backoffUntil > now) {
                        console.error("[Rolling Keys] Key ".concat(index, " in backoff until ").concat(new Date(keyStatus.backoffUntil).toISOString()));
                        return [3 /*break*/, 3];
                    }
                    // Key is available
                    state.currentIndex = (index + 1) % keys.length;
                    keyStatus.lastUsed = now;
                    return [4 /*yield*/, saveState(state)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { key: keys[index], index: index }];
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: 
                // All keys in backoff
                return [2 /*return*/, null];
            }
        });
    });
}
/**
 * Mark a key as failed with exponential backoff
 */
function markKeyFailed(state, keyIndex) {
    return __awaiter(this, void 0, void 0, function () {
        var keyStatus, backoffMs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    keyStatus = state.keyStatus[keyIndex];
                    keyStatus.failureCount++;
                    keyStatus.lastFailure = Date.now();
                    keyStatus.healthy = false;
                    backoffMs = Math.min(60000 * Math.pow(2, keyStatus.failureCount - 1), 3600000);
                    keyStatus.backoffUntil = Date.now() + backoffMs;
                    console.error("[Rolling Keys] Marked key ".concat(keyIndex, " as failed (failure #").concat(keyStatus.failureCount, "), backoff: ").concat(backoffMs / 1000, "s"));
                    return [4 /*yield*/, saveState(state)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Recover a key (mark as healthy)
 */
function recoverKey(state, keyIndex) {
    return __awaiter(this, void 0, void 0, function () {
        var keyStatus;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    keyStatus = state.keyStatus[keyIndex];
                    keyStatus.healthy = true;
                    keyStatus.failureCount = 0;
                    keyStatus.backoffUntil = undefined;
                    return [4 /*yield*/, saveState(state)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Detect if an error is a rate limit / auth error
 */
function isKeyError(error) {
    var errorLower = error.toLowerCase();
    return (errorLower.includes("429") ||
        errorLower.includes("rate limit") ||
        errorLower.includes("401") ||
        errorLower.includes("unauthorized") ||
        errorLower.includes("403") ||
        errorLower.includes("forbidden"));
}
/**
 * Spawn Claude with rolling keys and auto-retry on failure
 */
function spawnClaudeWithRetry(args, config) {
    return __awaiter(this, void 0, void 0, function () {
        var state, retries, _loop_1, state_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fs_1.promises.mkdir(STATE_DIR, { recursive: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, loadState()];
                case 2:
                    state = _a.sent();
                    retries = 0;
                    _loop_1 = function () {
                        var result, key, index, child;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, getNextAvailableKey(state)];
                                case 1:
                                    result = _b.sent();
                                    if (!result) {
                                        console.error("[Rolling Keys] All keys failed or in backoff");
                                        throw new Error("All API keys failed or in backoff");
                                    }
                                    key = result.key, index = result.index;
                                    console.error("[Rolling Keys] Using key ".concat(index, ": ").concat(key.substring(0, 20), "..."));
                                    child = (0, child_process_1.spawn)("claude", args, {
                                        env: __assign(__assign({}, process.env), { ANTHROPIC_API_KEY: key }),
                                        stdio: "inherit",
                                    });
                                    return [2 /*return*/, { value: new Promise(function (resolve, reject) {
                                                var hasResolved = false;
                                                child.on("exit", function (code) {
                                                    if (!hasResolved) {
                                                        hasResolved = true;
                                                        resolve(code !== null && code !== void 0 ? code : 0);
                                                    }
                                                });
                                                child.on("error", function (error) { return __awaiter(_this, void 0, void 0, function () {
                                                    var errorMsg;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0:
                                                                if (!!hasResolved) return [3 /*break*/, 5];
                                                                hasResolved = true;
                                                                errorMsg = String(error);
                                                                if (!isKeyError(errorMsg)) return [3 /*break*/, 4];
                                                                console.error("[Rolling Keys] Key ".concat(index, " failed, switching to next key..."));
                                                                // Mark key as failed
                                                                return [4 /*yield*/, markKeyFailed(state, index)];
                                                            case 1:
                                                                // Mark key as failed
                                                                _a.sent();
                                                                if (!(retries < config.maxRetries - 1)) return [3 /*break*/, 3];
                                                                retries++;
                                                                console.error("[Rolling Keys] Retry ".concat(retries, "/").concat(config.maxRetries - 1, "..."));
                                                                // Wait a bit before retry
                                                                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, config.retryDelayMs); })];
                                                            case 2:
                                                                // Wait a bit before retry
                                                                _a.sent();
                                                                // Try again with new state
                                                                spawnClaudeWithRetry(args, config)
                                                                    .then(resolve)
                                                                    .catch(reject);
                                                                return [2 /*return*/];
                                                            case 3:
                                                                reject(new Error("All retries exhausted"));
                                                                return [2 /*return*/];
                                                            case 4:
                                                                reject(error);
                                                                _a.label = 5;
                                                            case 5: return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            }) }];
                            }
                        });
                    };
                    _a.label = 3;
                case 3:
                    if (!(retries < config.maxRetries)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1()];
                case 4:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    return [3 /*break*/, 3];
                case 5: throw new Error("Should not reach here");
            }
        });
    });
}
// Main entry point
var args = process.argv.slice(2);
console.error("[Rolling Keys Supervisor] Starting Claude with automatic key rotation...");
spawnClaudeWithRetry(args, {
    maxRetries: 10,
    retryDelayMs: 1000,
})
    .then(function (code) {
    process.exit(code);
})
    .catch(function (error) {
    console.error("[Rolling Keys Supervisor] Error:", error);
    process.exit(1);
});
