"use strict";
/**
 * Node.js & npm Tool Installer
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
exports.NodeTool = void 0;
var base_1 = require("./base");
var NodeTool = /** @class */ (function (_super) {
    __extends(NodeTool, _super);
    function NodeTool() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "node";
        _this.description = "Node.js and npm package manager";
        return _this;
    }
    NodeTool.prototype.isApplicable = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Node.js is useful for all environments (macOS, Linux, WSL)
                return [2 /*return*/, true];
            });
        });
    };
    NodeTool.prototype.checkInstalled = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            var hasNode, hasNpm;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.commandExists("node")];
                    case 1:
                        hasNode = _a.sent();
                        return [4 /*yield*/, this.commandExists("npm")];
                    case 2:
                        hasNpm = _a.sent();
                        return [2 /*return*/, hasNode && hasNpm];
                }
            });
        });
    };
    NodeTool.prototype.install = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            var yarnSource, removeYarnCmd, updateCmd, installCmd, updateProc, updateExitCode, installProc, installExitCode, brewProc, brewExitCode;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("  Installing ".concat(this.name, "..."));
                        if (!(env.os === "linux")) return [3 /*break*/, 3];
                        if (!env.hasSudo && !env.isRoot) {
                            console.log("  ⚠ Node.js installation requires sudo or root privileges");
                            console.log("  Skipping Node.js installation (install manually with: sudo apt update && sudo apt install -y nodejs npm)");
                            return [2 /*return*/];
                        }
                        yarnSource = "/etc/apt/sources.list.d/yarn.list";
                        removeYarnCmd = env.isRoot
                            ? ["rm", "-f", yarnSource]
                            : ["sudo", "rm", "-f", yarnSource];
                        console.log("  Removing problematic Yarn repository (if exists)...");
                        Bun.spawn(removeYarnCmd, {
                            stdout: "inherit",
                            stderr: "inherit",
                        }).exited;
                        updateCmd = env.isRoot
                            ? ["apt-get", "update", "-qq"]
                            : ["sudo", "apt-get", "update", "-qq"];
                        installCmd = env.isRoot
                            ? ["apt-get", "install", "-y", "nodejs", "npm"]
                            : ["sudo", "apt-get", "install", "-y", "nodejs", "npm"];
                        console.log("  Updating package list...");
                        updateProc = Bun.spawn(updateCmd, {
                            stdout: "inherit",
                            stderr: "inherit",
                        });
                        return [4 /*yield*/, updateProc.exited];
                    case 1:
                        updateExitCode = _a.sent();
                        if (updateExitCode !== 0) {
                            throw new Error("Failed to update package list");
                        }
                        console.log("  Installing Node.js and npm...");
                        installProc = Bun.spawn(installCmd, {
                            stdout: "inherit",
                            stderr: "inherit",
                        });
                        return [4 /*yield*/, installProc.exited];
                    case 2:
                        installExitCode = _a.sent();
                        if (installExitCode !== 0) {
                            throw new Error("Failed to install ".concat(this.name));
                        }
                        console.log("  \u2713 ".concat(this.name, " installed"));
                        return [3 /*break*/, 5];
                    case 3:
                        if (!(env.os === "macos")) return [3 /*break*/, 5];
                        // macOS: Try Homebrew
                        console.log("  Installing Node.js via Homebrew (macOS)...");
                        brewProc = Bun.spawn(["brew", "install", "node"], {
                            stdout: "inherit",
                            stderr: "inherit",
                        });
                        return [4 /*yield*/, brewProc.exited];
                    case 4:
                        brewExitCode = _a.sent();
                        if (brewExitCode !== 0) {
                            console.log("  ⚠ Homebrew installation failed. Install Node.js manually:");
                            console.log("    brew install node");
                            return [2 /*return*/];
                        }
                        console.log("  \u2713 ".concat(this.name, " installed via Homebrew"));
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return NodeTool;
}(base_1.BaseTool));
exports.NodeTool = NodeTool;
