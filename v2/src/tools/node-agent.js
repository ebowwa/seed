"use strict";
/**
 * Node Agent Tool Installer
 * Ralph Loop orchestration API server
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.NodeAgentTool = void 0;
var base_1 = require("./base");
var NodeAgentTool = /** @class */ (function (_super) {
    __extends(NodeAgentTool, _super);
    function NodeAgentTool() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "node-agent";
        _this.description = "Ralph Loop orchestration API server for VPS nodes";
        return _this;
    }
    NodeAgentTool.prototype.isApplicable = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Install on all environments (prompt in interactive mode)
                return [2 /*return*/, true];
            });
        });
    };
    NodeAgentTool.prototype.checkInstalled = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.commandExists("node-agent")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    NodeAgentTool.prototype.install = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            var ctx, possiblePaths, seedPath, agentPath, _i, possiblePaths_1, path, resolvedPath, stdout, testPath, exitCode, installProc, installExitCode, buildProc, buildExitCode, binPath, _a, wrapperContent, writeProc, systemctlExit, logPath, pidPath, pidCheckExit, pid, killExit, startProc, psExit;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        ctx = this.getContext(env);
                        possiblePaths = [
                            process.cwd(), // Current directory (might be v2)
                            "".concat(process.cwd(), "/.."), // Parent of current directory
                            "".concat(ctx.homeDir, "/seed"), // ~/seed
                            "/workspaces/seed", // Codespaces
                            "/home/".concat(process.env.USER, "/seed"),
                        ];
                        seedPath = "";
                        agentPath = "";
                        _i = 0, possiblePaths_1 = possiblePaths;
                        _b.label = 1;
                    case 1:
                        if (!(_i < possiblePaths_1.length)) return [3 /*break*/, 6];
                        path = possiblePaths_1[_i];
                        resolvedPath = path;
                        if (!(path === "." || path === "./" || path.startsWith("..") || !path.startsWith("/"))) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.exec(["realpath", path])];
                    case 2:
                        stdout = (_b.sent()).stdout;
                        resolvedPath = stdout.trim();
                        _b.label = 3;
                    case 3:
                        testPath = "".concat(resolvedPath, "/node-agent");
                        return [4 /*yield*/, this.exec(["test", "-d", testPath])];
                    case 4:
                        exitCode = (_b.sent()).exitCode;
                        if (exitCode === 0) {
                            seedPath = resolvedPath;
                            agentPath = testPath;
                            return [3 /*break*/, 6];
                        }
                        _b.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        // Check if node-agent directory was found
                        if (!agentPath) {
                            console.log("  \u2298 ".concat(this.name, " source not found (tried: ").concat(possiblePaths.join(", "), "), skipping"));
                            return [2 /*return*/];
                        }
                        // Auto-install node-agent (always yes)
                        console.log("  \u2713 Auto-installing ".concat(this.name, "..."));
                        // Install dependencies
                        console.log("  \u2192 Installing dependencies...");
                        installProc = Bun.spawn(["bun", "install"], {
                            cwd: agentPath,
                            stdout: "inherit",
                            stderr: "inherit",
                        });
                        return [4 /*yield*/, installProc.exited];
                    case 7:
                        installExitCode = _b.sent();
                        if (installExitCode !== 0) {
                            throw new Error("Failed to install ".concat(this.name, " dependencies"));
                        }
                        // Build the agent
                        // TINKER: Add --target bun for Node.js built-ins
                        // Issue: Browser build cannot import Node.js builtin: "child_process"
                        // Solution: --target bun tells Bun to build for Bun runtime, not browser
                        console.log("  \u2192 Building ".concat(this.name, "..."));
                        buildProc = Bun.spawn(["bun", "build", "src/index.ts", "--target", "bun", "--outdir", "dist"], {
                            cwd: agentPath,
                            stdout: "inherit",
                            stderr: "inherit",
                        });
                        return [4 /*yield*/, buildProc.exited];
                    case 8:
                        buildExitCode = _b.sent();
                        if (buildExitCode !== 0) {
                            throw new Error("Failed to build ".concat(this.name));
                        }
                        binPath = "".concat(ctx.binDir, "/node-agent");
                        return [4 /*yield*/, this.ensureDir(ctx.binDir)];
                    case 9:
                        _b.sent();
                        _b.label = 10;
                    case 10:
                        _b.trys.push([10, 12, , 13]);
                        // Remove existing if present
                        return [4 /*yield*/, this.exec(["rm", "-f", binPath])];
                    case 11:
                        // Remove existing if present
                        _b.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        _a = _b.sent();
                        return [3 /*break*/, 13];
                    case 13:
                        wrapperContent = "#!/bin/bash\ncd \"".concat(agentPath, "\" || exit 1\nbun run src/index.ts \"$@\"\n");
                        writeProc = Bun.spawn([
                            "sh",
                            "-c",
                            "cat > \"".concat(binPath, "\" << 'WRAPPER_EOF'\n").concat(wrapperContent, "\nWRAPPER_EOF")
                        ], {
                            stdout: "pipe",
                            stderr: "pipe",
                        });
                        return [4 /*yield*/, writeProc.exited];
                    case 14:
                        _b.sent();
                        // Make it executable
                        return [4 /*yield*/, this.exec(["chmod", "+x", binPath])];
                    case 15:
                        // Make it executable
                        _b.sent();
                        console.log("  \u2713 ".concat(this.name, " installed to ").concat(binPath));
                        // Start the service (without systemd for containers)
                        console.log("  \u2192 Starting ".concat(this.name, "..."));
                        return [4 /*yield*/, this.exec(["which", "systemctl"], { stdout: "pipe", stderr: "pipe" })];
                    case 16:
                        systemctlExit = (_b.sent()).exitCode;
                        if (!(systemctlExit === 0)) return [3 /*break*/, 17];
                        // Use systemd service
                        console.log("  \u2192 ".concat(this.name, " will be started by systemd (managed by setup.sh)"));
                        return [3 /*break*/, 24];
                    case 17:
                        logPath = "".concat(agentPath, "/node-agent.log");
                        pidPath = "".concat(agentPath, "/node-agent.pid");
                        return [4 /*yield*/, this.exec(["test", "-f", pidPath], { stdout: "pipe", stderr: "pipe" })];
                    case 18:
                        pidCheckExit = (_b.sent()).exitCode;
                        if (!(pidCheckExit === 0)) return [3 /*break*/, 21];
                        return [4 /*yield*/, this.exec(["cat", pidPath])];
                    case 19:
                        pid = (_b.sent()).stdout;
                        return [4 /*yield*/, this.exec(["kill", "-0", pid.trim()], { stdout: "pipe", stderr: "pipe" })];
                    case 20:
                        killExit = (_b.sent()).exitCode;
                        if (killExit === 0) {
                            console.log("  \u2713 ".concat(this.name, " already running (PID: ").concat(pid.trim(), ")"));
                            console.log("  \u2192 logs: ".concat(logPath));
                            return [2 /*return*/];
                        }
                        _b.label = 21;
                    case 21:
                        startProc = Bun.spawn(["nohup", "bun", "run", "src/index.ts"], {
                            cwd: agentPath,
                            stdout: "pipe",
                            stderr: "pipe",
                            env: __assign(__assign({}, process.env), { NODE_AGENT_LOG_PATH: logPath, NODE_AGENT_PID_PATH: pidPath }),
                        });
                        // Wait a bit and check if it started
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 22:
                        // Wait a bit and check if it started
                        _b.sent();
                        return [4 /*yield*/, this.exec(["ps", "aux", "|", "grep", "[n]ode-agent"], { stdout: "pipe", stderr: "pipe" })];
                    case 23:
                        psExit = (_b.sent()).exitCode;
                        if (psExit === 0) {
                            console.log("  \u2713 ".concat(this.name, " started and listening on port 8911 (logs: ").concat(logPath, ")"));
                        }
                        else {
                            console.log("  \u26A0 ".concat(this.name, " started but status unknown (logs: ").concat(logPath, ")"));
                        }
                        _b.label = 24;
                    case 24: return [2 /*return*/];
                }
            });
        });
    };
    return NodeAgentTool;
}(base_1.BaseTool));
exports.NodeAgentTool = NodeAgentTool;
