#!/usr/bin/env bun
"use strict";
/**
 * Lane Tool Test
 * Tests the LaneTool class functionality
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
var bun_test_1 = require("bun:test");
var lane_1 = require("../v2/src/tools/lane");
(0, bun_test_1.describe)("LaneTool", function () {
    var laneTool;
    var mockEnv;
    (0, bun_test_1.beforeEach)(function () {
        laneTool = new lane_1.LaneTool();
        // Mock environment for testing
        mockEnv = {
            os: "linux",
            arch: "x64",
            platform: "linux",
            type: "vps",
            hasSudo: true,
            isRoot: true,
            hasDocker: false,
            homeDir: "/tmp/test-home",
            cacheDir: "/tmp/test-home/.cache",
            configDir: "/tmp/test-home/.config",
            binDir: "/usr/local/bin",
            ci: null,
            isCodespaces: false,
            isContainer: false,
            isVPS: true,
            vpsProvider: "hetzner",
        };
    });
    (0, bun_test_1.afterEach)(function () {
        // Cleanup test artifacts
    });
    (0, bun_test_1.describe)("properties", function () {
        (0, bun_test_1.test)("should have correct name", function () {
            (0, bun_test_1.expect)(laneTool.name).toBe("lane");
        });
        (0, bun_test_1.test)("should have description", function () {
            (0, bun_test_1.expect)(laneTool.description).toBe("Lane CLI - Git worktree alternative for parallel development");
        });
        (0, bun_test_1.test)("should use npm package", function () {
            (0, bun_test_1.expect)(laneTool.NPM_PACKAGE).toBe("@ebowwa/lane");
        });
    });
    (0, bun_test_1.describe)("isApplicable", function () {
        (0, bun_test_1.test)("should be applicable for VPS environments", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mockEnv.type = "vps";
                        _a = bun_test_1.expect;
                        return [4 /*yield*/, laneTool.isApplicable(mockEnv)];
                    case 1:
                        _a.apply(void 0, [_b.sent()]).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)("should be applicable for local environments", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mockEnv.type = "local";
                        _a = bun_test_1.expect;
                        return [4 /*yield*/, laneTool.isApplicable(mockEnv)];
                    case 1:
                        _a.apply(void 0, [_b.sent()]).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)("should be applicable for codespaces", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mockEnv.type = "codespaces";
                        _a = bun_test_1.expect;
                        return [4 /*yield*/, laneTool.isApplicable(mockEnv)];
                    case 1:
                        _a.apply(void 0, [_b.sent()]).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)("should NOT be applicable for CI environments", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mockEnv.type = "ci";
                        _a = bun_test_1.expect;
                        return [4 /*yield*/, laneTool.isApplicable(mockEnv)];
                    case 1:
                        _a.apply(void 0, [_b.sent()]).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, bun_test_1.describe)("checkInstalled", function () {
        (0, bun_test_1.test)("should return true when lane command exists", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // Mock commandExists to return true
                        laneTool.commandExists = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, true];
                        }); }); };
                        _a = bun_test_1.expect;
                        return [4 /*yield*/, laneTool.checkInstalled(mockEnv)];
                    case 1:
                        _a.apply(void 0, [_b.sent()]).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)("should return false when lane command does not exist", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // Mock commandExists to return false
                        laneTool.commandExists = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, false];
                        }); }); };
                        _a = bun_test_1.expect;
                        return [4 /*yield*/, laneTool.checkInstalled(mockEnv)];
                    case 1:
                        _a.apply(void 0, [_b.sent()]).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, bun_test_1.describe)("npm package configuration", function () {
        (0, bun_test_1.test)("should use @ebowwa/lane package", function () {
            (0, bun_test_1.expect)(laneTool.NPM_PACKAGE).toBe("@ebowwa/lane");
        });
    });
});
