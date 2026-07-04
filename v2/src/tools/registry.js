"use strict";
/**
 * Tool Registry
 * Manages tool discovery, filtering, and installation
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
exports.ToolRegistry = void 0;
var bun_1 = require("./bun");
var claude_1 = require("./claude");
var lane_1 = require("./lane");
var gh_1 = require("./gh");
var doppler_1 = require("./doppler");
var node_1 = require("./node");
var tmux_1 = require("./tmux");
var ralph_1 = require("./ralph");
var ToolRegistry = /** @class */ (function () {
    function ToolRegistry(env, options) {
        if (options === void 0) { options = {}; }
        this.env = env;
        this.options = options;
        // Register all available tools
        this.tools = [
            new bun_1.BunTool(),
            new node_1.NodeTool(),
            new tmux_1.TmuxTool(),
            new claude_1.ClaudeTool(),
            new lane_1.LaneTool(),
            new ralph_1.RalphTool(),
            new gh_1.GhTool(),
            new doppler_1.DopplerTool(),
        ];
    }
    /**
     * Get all tools applicable to the current environment
     */
    ToolRegistry.prototype.getToolsForEnvironment = function () {
        return __awaiter(this, void 0, void 0, function () {
            var applicable, _i, _a, tool;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        applicable = [];
                        _i = 0, _a = this.tools;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        tool = _a[_i];
                        return [4 /*yield*/, tool.isApplicable(this.env)];
                    case 2:
                        if (_b.sent()) {
                            applicable.push(tool);
                        }
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, applicable];
                }
            });
        });
    };
    /**
     * List all tools with their installation status
     */
    ToolRegistry.prototype.listTools = function () {
        return __awaiter(this, void 0, void 0, function () {
            var info, _i, _a, tool, installed;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        info = [];
                        _i = 0, _a = this.tools;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        tool = _a[_i];
                        return [4 /*yield*/, tool.checkInstalled(this.env)];
                    case 2:
                        installed = _b.sent();
                        info.push({
                            name: tool.name,
                            description: tool.description,
                            installed: installed,
                        });
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, info];
                }
            });
        });
    };
    /**
     * Register a custom tool
     */
    ToolRegistry.prototype.registerTool = function (tool) {
        this.tools.push(tool);
    };
    return ToolRegistry;
}());
exports.ToolRegistry = ToolRegistry;
