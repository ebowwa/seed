"use strict";
/**
 * Lane CLI Tool Installer
 * Installs lane from npm using bun
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
exports.LaneTool = void 0;
var base_1 = require("./base");
var LaneTool = /** @class */ (function (_super) {
    __extends(LaneTool, _super);
    function LaneTool() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "lane";
        _this.description = "Lane CLI - Git worktree alternative for parallel development";
        // NPM package configuration
        _this.NPM_PACKAGE = "@ebowwa/lane";
        return _this;
    }
    LaneTool.prototype.isApplicable = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Lane is useful for all environments where git work is done
                // Skip in CI/CD where worktrees aren't needed
                return [2 /*return*/, env.type !== "ci"];
            });
        });
    };
    LaneTool.prototype.checkInstalled = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.commandExists("lane")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    LaneTool.prototype.install = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            var ctx, installDir, installProc, exitCode, binDir, symlinkPath, targetPath, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        ctx = this.getContext(env);
                        installDir = ctx.homeDir + "/.lane-install";
                        console.log("  Installing ".concat(this.name, " from npm (").concat(this.NPM_PACKAGE, ")..."));
                        // Create temp install directory
                        return [4 /*yield*/, this.exec(["mkdir", "-p", installDir])];
                    case 1:
                        // Create temp install directory
                        _b.sent();
                        // Install package with bun
                        console.log("  \u2192 Running: bun install ".concat(this.NPM_PACKAGE, "..."));
                        installProc = Bun.spawn(["bun", "install", this.NPM_PACKAGE], {
                            cwd: installDir,
                            stdout: "inherit",
                            stderr: "inherit",
                        });
                        return [4 /*yield*/, installProc.exited];
                    case 2:
                        exitCode = _b.sent();
                        if (exitCode !== 0) {
                            throw new Error("Failed to install ".concat(this.name, " from npm"));
                        }
                        // Create symlink to ~/.local/bin
                        console.log("  \u2192 Creating symlink to ~/.local/bin/lane...");
                        binDir = ctx.homeDir + "/.local/bin";
                        return [4 /*yield*/, this.exec(["mkdir", "-p", binDir])];
                    case 3:
                        _b.sent();
                        symlinkPath = binDir + "/lane";
                        targetPath = installDir + "/node_modules/.bin/lane";
                        // Remove existing symlink if it exists
                        return [4 /*yield*/, this.exec(["rm", "-f", symlinkPath])];
                    case 4:
                        // Remove existing symlink if it exists
                        _b.sent();
                        // Create new symlink
                        return [4 /*yield*/, this.exec(["ln", "-s", targetPath, symlinkPath])];
                    case 5:
                        // Create new symlink
                        _b.sent();
                        // Set up shell completion
                        console.log("  \u2192 Setting up shell integration...");
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.exec(["lane", "init-shell"], { cwd: ctx.homeDir, env: __assign(__assign({}, process.env), { HOME: ctx.homeDir }) })];
                    case 7:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        _a = _b.sent();
                        // init-shell might fail if shell config is weird, non-fatal
                        console.log("  \u26A0 Shell integration skipped (you can run 'lane init-shell' manually)");
                        return [3 /*break*/, 9];
                    case 9:
                        console.log("  \u2713 ".concat(this.name, " installed from ").concat(this.NPM_PACKAGE));
                        return [2 /*return*/];
                }
            });
        });
    };
    return LaneTool;
}(base_1.BaseTool));
exports.LaneTool = LaneTool;
