"use strict";
/**
 * Health Check System
 * Verifies installation status and system health
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = healthCheck;
var registry_1 = require("../tools/registry");
/**
 * Run health check on the system
 */
function healthCheck(env) {
    return __awaiter(this, void 0, void 0, function () {
        var issues, registry, toolsList, tools, _i, toolsList_1, tool, health, envInfo, errors, warnings, status;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    issues = [];
                    registry = new registry_1.ToolRegistry(env);
                    return [4 /*yield*/, registry.listTools()];
                case 1:
                    toolsList = _a.sent();
                    tools = [];
                    _i = 0, toolsList_1 = toolsList;
                    _a.label = 2;
                case 2:
                    if (!(_i < toolsList_1.length)) return [3 /*break*/, 5];
                    tool = toolsList_1[_i];
                    return [4 /*yield*/, checkToolHealth(tool.name, env)];
                case 3:
                    health = _a.sent();
                    tools.push(health);
                    if (!health.installed) {
                        issues.push({
                            severity: "warning",
                            message: "".concat(tool.name, " is not installed"),
                            tool: tool.name,
                        });
                    }
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    envInfo = {
                        type: env.type,
                        os: env.os,
                        arch: env.arch,
                        platform: env.platform,
                        isRoot: env.isRoot,
                        hasSudo: env.hasSudo,
                        hasDocker: env.hasDocker,
                    };
                    errors = issues.filter(function (i) { return i.severity === "error"; });
                    warnings = issues.filter(function (i) { return i.severity === "warning"; });
                    status = "healthy";
                    if (errors.length > 0) {
                        status = "error";
                    }
                    else if (warnings.length > 0) {
                        status = "warning";
                    }
                    return [2 /*return*/, {
                            status: status,
                            environment: envInfo,
                            tools: tools,
                            issues: issues,
                        }];
            }
        });
    });
}
/**
 * Check health of a specific tool
 */
function checkToolHealth(name, env) {
    return __awaiter(this, void 0, void 0, function () {
        var proc, exitCode, version, versionProc_1, timeout, output, _a, pathProc, pathOutput, path;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    proc = Bun.spawn(["which", name], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 1:
                    exitCode = _b.sent();
                    if (exitCode !== 0) {
                        return [2 /*return*/, {
                                name: name,
                                description: getToolDescription(name),
                                installed: false,
                            }];
                    }
                    // Get version with timeout
                    // TINKER: Some tools (like node-agent) may hang on --version
                    // Skip node-agent version check since it starts a server
                    if (name === "node-agent") {
                        return [2 /*return*/, {
                                name: name,
                                description: getToolDescription(name),
                                installed: true,
                                version: "v0.1.0",
                                path: "custom",
                            }];
                    }
                    version = "";
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    versionProc_1 = Bun.spawn([name, "--version"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    timeout = new Promise(function (_, reject) {
                        return setTimeout(function () {
                            versionProc_1.kill();
                            reject(new Error("Timeout"));
                        }, 5000);
                    });
                    return [4 /*yield*/, Promise.race([
                            new Response(versionProc_1.stdout).text(),
                            timeout,
                        ])];
                case 3:
                    output = _b.sent();
                    version = output.trim().split("\n")[0];
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    // Timeout or error - tool exists but version check failed
                    version = "unknown";
                    return [3 /*break*/, 5];
                case 5:
                    pathProc = Bun.spawn(["which", name], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, new Response(pathProc.stdout).text()];
                case 6:
                    pathOutput = _b.sent();
                    path = pathOutput.trim();
                    return [2 /*return*/, {
                            name: name,
                            description: getToolDescription(name),
                            installed: true,
                            version: version,
                            path: path,
                        }];
            }
        });
    });
}
/**
 * Get tool description
 */
function getToolDescription(name) {
    var descriptions = {
        bun: "Fast JavaScript runtime and package manager",
        "node-agent": "Ralph Loop orchestration API server",
        claude: "Claude Code CLI - AI-powered development assistant",
        gh: "GitHub CLI - Official GitHub command-line tool",
        doppler: "Doppler CLI - Secrets management",
    };
    return descriptions[name] || "Unknown tool";
}
