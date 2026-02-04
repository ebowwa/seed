"use strict";
// Git Worktree Management Service
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
exports.GitService = void 0;
var fs_1 = require("fs");
var child_process_1 = require("child_process");
var util_1 = require("util");
var path_1 = require("path");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
// Configuration
var REPOS_BASE_PATH = process.env.REPOS_BASE_PATH || path_1.default.join(process.env.HOME || "", "repos");
var DEFAULT_REPOSITORY = "main-repo";
var GitService = /** @class */ (function () {
    function GitService() {
        this.reposBasePath = REPOS_BASE_PATH;
    }
    /**
     * List all git worktrees for a repository
     */
    GitService.prototype.listWorktrees = function () {
        return __awaiter(this, arguments, void 0, function (repository) {
            var repoPath, _a, stdout, worktrees, _i, _b, line, parts, worktreePath, commit, branch, id, stats, error_1;
            var _c;
            if (repository === void 0) { repository = DEFAULT_REPOSITORY; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        repoPath = path_1.default.join(this.reposBasePath, repository);
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        // Check if repo exists
                        return [4 /*yield*/, fs_1.promises.access(repoPath)];
                    case 2:
                        // Check if repo exists
                        _d.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _d.sent();
                        // Repo doesn't exist, return empty
                        return [2 /*return*/, []];
                    case 4:
                        _d.trys.push([4, 10, , 11]);
                        return [4 /*yield*/, execAsync("git worktree list", { cwd: repoPath })];
                    case 5:
                        stdout = (_d.sent()).stdout;
                        worktrees = [];
                        _i = 0, _b = stdout.trim().split("\n");
                        _d.label = 6;
                    case 6:
                        if (!(_i < _b.length)) return [3 /*break*/, 9];
                        line = _b[_i];
                        if (!line)
                            return [3 /*break*/, 8];
                        parts = line.trim().split(/\s+/);
                        worktreePath = parts[0];
                        commit = parts[1];
                        branch = ((_c = parts[2]) === null || _c === void 0 ? void 0 : _c.replace(/^\[|\]$/g, "")) || "detached";
                        id = worktreePath.split("/").pop() || path_1.default.basename(worktreePath);
                        return [4 /*yield*/, fs_1.promises.stat(worktreePath).catch(function () { return null; })];
                    case 7:
                        stats = _d.sent();
                        worktrees.push({
                            id: id,
                            branch: branch,
                            commit: commit,
                            path: worktreePath,
                            created_at: (stats === null || stats === void 0 ? void 0 : stats.mtime.toISOString()) || new Date().toISOString(),
                            status: "ready",
                        });
                        _d.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 6];
                    case 9: return [2 /*return*/, worktrees];
                    case 10:
                        error_1 = _d.sent();
                        console.error("Failed to list worktrees:", error_1);
                        throw new Error("GIT_WORKTREE_LIST_FAILED");
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new git worktree
     */
    GitService.prototype.createWorktree = function (request_1) {
        return __awaiter(this, arguments, void 0, function (request, repository) {
            var repoPath, worktreePath, _a, branch, command, error_2;
            if (repository === void 0) { repository = DEFAULT_REPOSITORY; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        repoPath = path_1.default.join(this.reposBasePath, repository);
                        worktreePath = path_1.default.join(this.reposBasePath, "".concat(repository, "-worktree-").concat(request.id));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 7]);
                        return [4 /*yield*/, fs_1.promises.access(repoPath)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 3:
                        _a = _b.sent();
                        if (!request.repository_url) return [3 /*break*/, 5];
                        return [4 /*yield*/, execAsync("git clone \"".concat(request.repository_url, "\" \"").concat(repoPath, "\""))];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 5: throw new Error("REPOSITORY_NOT_FOUND");
                    case 6: return [3 /*break*/, 7];
                    case 7:
                        branch = request.commit ? "".concat(request.branch, "^^{}") : request.branch;
                        command = "git worktree add \"".concat(worktreePath, "\" ").concat(branch);
                        _b.label = 8;
                    case 8:
                        _b.trys.push([8, 11, , 12]);
                        return [4 /*yield*/, execAsync(command, { cwd: repoPath })];
                    case 9:
                        _b.sent();
                        // Create .claude directory in worktree
                        return [4 /*yield*/, fs_1.promises.mkdir(path_1.default.join(worktreePath, ".claude"), { recursive: true })];
                    case 10:
                        // Create .claude directory in worktree
                        _b.sent();
                        return [2 /*return*/, {
                                id: request.id,
                                branch: request.branch,
                                commit: request.commit,
                                path: worktreePath,
                                created_at: new Date().toISOString(),
                                status: "ready",
                            }];
                    case 11:
                        error_2 = _b.sent();
                        console.error("Failed to create worktree:", error_2);
                        throw new Error("GIT_WORKTREE_CREATE_FAILED");
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Remove a git worktree
     */
    GitService.prototype.removeWorktree = function (worktreeId_1) {
        return __awaiter(this, arguments, void 0, function (worktreeId, repository) {
            var repoPath, worktreePath, error_3;
            if (repository === void 0) { repository = DEFAULT_REPOSITORY; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        repoPath = path_1.default.join(this.reposBasePath, repository);
                        worktreePath = path_1.default.join(this.reposBasePath, "".concat(repository, "-worktree-").concat(worktreeId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // First, stop any Ralph loop in this worktree
                        // (This will be handled by the Ralph service)
                        // Remove the worktree
                        return [4 /*yield*/, execAsync("git worktree remove \"".concat(worktreePath, "\""), { cwd: repoPath })];
                    case 2:
                        // First, stop any Ralph loop in this worktree
                        // (This will be handled by the Ralph service)
                        // Remove the worktree
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.error("Failed to remove worktree:", error_3);
                        throw new Error("GIT_WORKTREE_REMOVE_FAILED");
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get recent commits from a worktree
     */
    GitService.prototype.getRecentCommits = function (worktreePath_1) {
        return __awaiter(this, arguments, void 0, function (worktreePath, count) {
            var stdout, commits, _i, _a, line, _b, hash, message, timestamp, error_4;
            if (count === void 0) { count = 5; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, execAsync("git log --pretty=format:\"%H|%s|%ct\" -".concat(count), { cwd: worktreePath })];
                    case 1:
                        stdout = (_c.sent()).stdout;
                        commits = [];
                        for (_i = 0, _a = stdout.trim().split("\n"); _i < _a.length; _i++) {
                            line = _a[_i];
                            if (!line)
                                continue;
                            _b = line.split("|"), hash = _b[0], message = _b[1], timestamp = _b[2];
                            commits.push({
                                hash: hash,
                                message: message,
                                timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
                            });
                        }
                        return [2 /*return*/, commits];
                    case 2:
                        error_4 = _c.sent();
                        console.error("Failed to get commits:", error_4);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return GitService;
}());
exports.GitService = GitService;
