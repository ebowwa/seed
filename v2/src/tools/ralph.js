"use strict";
/**
 * Ralph CLI Tool Installer
 * Clones Ralph repository and installs bash scripts to PATH
 *
 * Ralph provides iterative development loops via bash scripts that spawn Claude Code.
 * This is different from lane - Ralph is bash-based, not a compiled CLI tool.
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
exports.RalphTool = void 0;
var base_1 = require("./base");
var RalphTool = /** @class */ (function (_super) {
    __extends(RalphTool, _super);
    function RalphTool() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "ralph";
        _this.description = "Ralph - Iterative development loops with Claude Code";
        // Ralph repository configuration
        _this.REPO_URL = "https://github.com/ebowwa/ralph.git";
        _this.BRANCH = "dev";
        _this.CLONE_DIR = "~/ralph";
        return _this;
    }
    RalphTool.prototype.isApplicable = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Ralph is useful for development environments
                // Skip in CI/CD where interactive loops aren't needed
                return [2 /*return*/, env.type !== "ci"];
            });
        });
    };
    RalphTool.prototype.checkInstalled = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.commandExists("ralph")];
                    case 1: 
                    // Check if ralph script exists in PATH
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RalphTool.prototype.install = function (env) {
        return __awaiter(this, void 0, void 0, function () {
            var ctx, cloneDir, scriptsDir, execSync, exists, error_1, scripts, _i, scripts_1, script, scriptPath, _a, error_2, error_3, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        ctx = this.getContext(env);
                        cloneDir = ctx.homeDir + "/ralph";
                        scriptsDir = "".concat(cloneDir, "/scripts");
                        console.log("  Installing ".concat(this.name, " from ").concat(this.REPO_URL, " (").concat(this.BRANCH, " branch)..."));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("child_process"); })];
                    case 2:
                        execSync = (_b.sent()).execSync;
                        exists = execSync("test -d ".concat(cloneDir, " && echo \"exists\" || echo \"not\""), {
                            encoding: "utf-8",
                            stdio: ["ignore", "pipe", "ignore"],
                        }).trim();
                        if (!(exists === "exists")) return [3 /*break*/, 6];
                        console.log("  \u2713 ".concat(this.name, " already cloned at ").concat(cloneDir));
                        console.log("  \u2192 Updating to latest from ".concat(this.BRANCH, "..."));
                        // Fetch and checkout the correct branch
                        return [4 /*yield*/, this.exec(["git", "-C", cloneDir, "fetch", "origin"], { cwd: cloneDir })];
                    case 3:
                        // Fetch and checkout the correct branch
                        _b.sent();
                        return [4 /*yield*/, this.exec(["git", "-C", cloneDir, "checkout", this.BRANCH], { cwd: cloneDir })];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, this.exec(["git", "-C", cloneDir, "pull", "origin", this.BRANCH], { cwd: cloneDir })];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 8];
                    case 6:
                        // Clone the repository
                        console.log("  \u2192 Cloning to ".concat(cloneDir, "..."));
                        return [4 /*yield*/, this.exec(["git", "clone", "-b", this.BRANCH, this.REPO_URL, cloneDir], { cwd: ctx.homeDir })];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_1 = _b.sent();
                        throw new Error("Failed to clone ralph: ".concat(error_1));
                    case 10:
                        // Make scripts executable
                        console.log("  \u2192 Setting up scripts...");
                        scripts = ["ralph.sh", "ralph-multi.sh", "ralph-team.sh", "autonomous-ralph.sh"];
                        _i = 0, scripts_1 = scripts;
                        _b.label = 11;
                    case 11:
                        if (!(_i < scripts_1.length)) return [3 /*break*/, 16];
                        script = scripts_1[_i];
                        scriptPath = "".concat(scriptsDir, "/").concat(script);
                        _b.label = 12;
                    case 12:
                        _b.trys.push([12, 14, , 15]);
                        return [4 /*yield*/, this.chmod(scriptPath, "+x")];
                    case 13:
                        _b.sent();
                        console.log("    \u2713 ".concat(script, " is executable"));
                        return [3 /*break*/, 15];
                    case 14:
                        _a = _b.sent();
                        console.log("    \u26A0 ".concat(script, " not found, skipping"));
                        return [3 /*break*/, 15];
                    case 15:
                        _i++;
                        return [3 /*break*/, 11];
                    case 16:
                        // Create symlinks in binDir
                        console.log("  \u2192 Creating symlinks in ".concat(ctx.binDir, "..."));
                        return [4 /*yield*/, this.ensureDir(ctx.binDir)];
                    case 17:
                        _b.sent();
                        _b.label = 18;
                    case 18:
                        _b.trys.push([18, 20, , 21]);
                        return [4 /*yield*/, this.exec(["ln", "-sf", "".concat(scriptsDir, "/ralph.sh"), "".concat(ctx.binDir, "/ralph")], { cwd: ctx.homeDir })];
                    case 19:
                        _b.sent();
                        console.log("    \u2713 ralph \u2192 ".concat(scriptsDir, "/ralph.sh"));
                        return [3 /*break*/, 21];
                    case 20:
                        error_2 = _b.sent();
                        console.log("    \u26A0 Failed to create ralph symlink: ".concat(error_2));
                        return [3 /*break*/, 21];
                    case 21:
                        _b.trys.push([21, 23, , 24]);
                        return [4 /*yield*/, this.exec(["ln", "-sf", "".concat(scriptsDir, "/ralph-multi.sh"), "".concat(ctx.binDir, "/ralph-multi")], { cwd: ctx.homeDir })];
                    case 22:
                        _b.sent();
                        console.log("    \u2713 ralph-multi \u2192 ".concat(scriptsDir, "/ralph-multi.sh"));
                        return [3 /*break*/, 24];
                    case 23:
                        error_3 = _b.sent();
                        console.log("    \u26A0 Failed to create ralph-multi symlink: ".concat(error_3));
                        return [3 /*break*/, 24];
                    case 24:
                        _b.trys.push([24, 26, , 27]);
                        return [4 /*yield*/, this.exec(["ln", "-sf", "".concat(scriptsDir, "/autonomous-ralph.sh"), "".concat(ctx.binDir, "/autonomous-ralph")], { cwd: ctx.homeDir })];
                    case 25:
                        _b.sent();
                        console.log("    \u2713 autonomous-ralph \u2192 ".concat(scriptsDir, "/autonomous-ralph.sh"));
                        return [3 /*break*/, 27];
                    case 26:
                        error_4 = _b.sent();
                        console.log("    \u26A0 Failed to create autonomous-ralph symlink: ".concat(error_4));
                        return [3 /*break*/, 27];
                    case 27:
                        console.log("  \u2713 ".concat(this.name, " installed from ").concat(this.BRANCH, " branch"));
                        console.log("\n  Usage:");
                        console.log("    ralph \"your task here\"              # Start single-agent loop");
                        console.log("    ralph-multi --agent-id foo \"task\"   # Start multi-agent loop");
                        console.log("    autonomous-ralph                    # Start 12-hour self-improvement");
                        return [2 /*return*/];
                }
            });
        });
    };
    return RalphTool;
}(base_1.BaseTool));
exports.RalphTool = RalphTool;
