#!/usr/bin/env bun
"use strict";
/**
 * Ralph Iterative Plugin Setup Script
 *
 * Automatically symlinks Ralph Iterative commands and skills
 * to the Claude Code plugin directory.
 */
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
var bun_1 = require("bun");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
// Configuration
var RALPH_REPO = "/root/repos/ralph";
var PLUGIN_DIR = (0, node_path_1.join)(RALPH_REPO, ".claude-plugin");
var COMMANDS_SOURCE = (0, node_path_1.join)(RALPH_REPO, "plugins/ralph-iterative/commands");
var SKILLS_SOURCE = (0, node_path_1.join)(RALPH_REPO, "plugins/ralph-iterative/skills");
var COMMANDS_TARGET = (0, node_path_1.join)(PLUGIN_DIR, "commands");
var SKILLS_TARGET = (0, node_path_1.join)(PLUGIN_DIR, "skills");
// ANSI colors
var colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    bold: "\x1b[1m",
};
function log(message, color) {
    if (color === void 0) { color = "reset"; }
    console.log("".concat(colors[color]).concat(message).concat(colors.reset));
}
function symlinkFile(source, target) {
    try {
        // Remove existing symlink/file if present
        if ((0, node_fs_1.existsSync)(target)) {
            (0, bun_1.$)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["rm ", ""], ["rm ", ""])), target);
        }
        (0, node_fs_1.symlinkSync)(source, target);
        return true;
    }
    catch (error) {
        log("  \u2717 Failed to symlink ".concat(source, ": ").concat(error.message), "red");
        return false;
    }
}
function setupCommands() {
    return __awaiter(this, void 0, void 0, function () {
        var files, commands, successCount, _i, commands_1, file, filename, target;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log("\n=== Setting up Commands ===", "blue");
                    // Ensure target directory exists
                    (0, node_fs_1.mkdirSync)(COMMANDS_TARGET, { recursive: true });
                    return [4 /*yield*/, (0, bun_1.$)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["ls ", "/*.md"], ["ls ", "/*.md"])), COMMANDS_SOURCE).text()];
                case 1:
                    files = _a.sent();
                    commands = files.split("\n").filter(function (f) { return f.endsWith(".md"); });
                    successCount = 0;
                    for (_i = 0, commands_1 = commands; _i < commands_1.length; _i++) {
                        file = commands_1[_i];
                        filename = file.split("/").pop();
                        target = (0, node_path_1.join)(COMMANDS_TARGET, filename);
                        if (symlinkFile(file, target)) {
                            log("  \u2713 ".concat(filename), "green");
                            successCount++;
                        }
                    }
                    log("\nLinked ".concat(successCount, "/").concat(commands.length, " commands"), "yellow");
                    return [2 /*return*/, successCount];
            }
        });
    });
}
function setupSkills() {
    return __awaiter(this, void 0, void 0, function () {
        var dirs, skills, successCount, _i, skills_1, dir, dirname_1, target;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log("\n=== Setting up Skills ===", "blue");
                    // Ensure target directory exists
                    (0, node_fs_1.mkdirSync)(SKILLS_TARGET, { recursive: true });
                    return [4 /*yield*/, (0, bun_1.$)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["ls -d ", "/*/"], ["ls -d ", "/*/"])), SKILLS_SOURCE).text()];
                case 1:
                    dirs = _a.sent();
                    skills = dirs.split("\n").filter(function (d) { return d.trim().length > 0; });
                    successCount = 0;
                    for (_i = 0, skills_1 = skills; _i < skills_1.length; _i++) {
                        dir = skills_1[_i];
                        dirname_1 = dir.split("/").filter(Boolean).pop();
                        target = (0, node_path_1.join)(SKILLS_TARGET, dirname_1);
                        if (symlinkFile(dir.trim(), target)) {
                            log("  \u2713 ".concat(dirname_1), "green");
                            successCount++;
                        }
                    }
                    log("\nLinked ".concat(successCount, "/").concat(skills.length, " skills"), "yellow");
                    return [2 /*return*/, successCount];
            }
        });
    });
}
function verifySettings() {
    log("\n=== Verifying Claude Settings ===", "blue");
    var settingsPath = "/root/.claude/settings.json";
    if (!(0, node_fs_1.existsSync)(settingsPath)) {
        log("  ✗ settings.json not found", "red");
        log("    Expected: ".concat(settingsPath), "yellow");
        return false;
    }
    var settings = yield (0, bun_1.$)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["cat ", ""], ["cat ", ""])), settingsPath).text();
    var settingsJson = JSON.parse(settings);
    var pluginDir = settingsJson["plugin-dir"];
    if (!pluginDir) {
        log("  ✗ plugin-dir not set in settings.json", "red");
        log("    Add: \"plugin-dir\": [\"".concat(PLUGIN_DIR, "\"]"), "yellow");
        return false;
    }
    if (pluginDir.includes(PLUGIN_DIR)) {
        log("  \u2713 plugin-dir correctly set to ".concat(PLUGIN_DIR), "green");
        return true;
    }
    log("  ! plugin-dir set to ".concat(pluginDir), "yellow");
    log("    Consider updating to: ".concat(PLUGIN_DIR), "yellow");
    return true;
}
function verifyInstallation() {
    log("\n=== Verifying Installation ===", "blue");
    // Check commands
    var commands = (0, bun_1.$)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["ls ", ""], ["ls ", ""])), COMMANDS_TARGET).text();
    var commandList = commands.split("\n").filter(function (f) { return f.endsWith(".md"); });
    log("  Commands: ".concat(commandList.length, " found"), commandList.length > 0 ? "green" : "red");
    // Check skills
    var skills = (0, bun_1.$)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["ls ", ""], ["ls ", ""])), SKILLS_TARGET).text();
    var skillList = skills.split("\n").filter(function (f) { return f.trim().length > 0; });
    log("  Skills: ".concat(skillList.length, " found"), skillList.length > 0 ? "green" : "red");
    // Show available commands
    if (commandList.length > 0) {
        log("\n  Available commands:", "blue");
        for (var _i = 0, commandList_1 = commandList; _i < commandList_1.length; _i++) {
            var cmd = commandList_1[_i];
            var name_1 = cmd.replace(".md", "");
            log("    /".concat(name_1), "green");
        }
    }
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var commandsCount, skillsCount, settingsOk;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log("\n" + "=".repeat(50), "blue");
                    log("  Ralph Iterative Plugin Setup", "bold");
                    log("=".repeat(50), "blue");
                    // Check if ralph repo exists
                    if (!(0, node_fs_1.existsSync)(RALPH_REPO)) {
                        log("\n\u2717 Ralph repo not found at ".concat(RALPH_REPO), "red");
                        log("  Clone ralph repo first:", "yellow");
                        log("  git clone https://github.com/ebowwa/ralph.git ".concat(RALPH_REPO), "yellow");
                        process.exit(1);
                    }
                    return [4 /*yield*/, setupCommands()];
                case 1:
                    commandsCount = _a.sent();
                    return [4 /*yield*/, setupSkills()
                        // Verify settings
                    ];
                case 2:
                    skillsCount = _a.sent();
                    settingsOk = verifySettings();
                    // Verify installation
                    verifyInstallation();
                    // Summary
                    log("\n" + "=".repeat(50), "blue");
                    log("  Setup Complete!", "green");
                    log("=".repeat(50), "blue");
                    log("\n  Commands linked: ".concat(commandsCount), "green");
                    log("  Skills linked: ".concat(skillsCount), "green");
                    log("  Settings verified: ".concat(settingsOk ? "✓" : "!"), settingsOk ? "green" : "yellow");
                    log("\n  Usage:", "blue");
                    log("    doppler run --project seed --config prd -- claude '/go \"task\" --completion-promise DONE' -p", "yellow");
                    log("\n");
                    return [2 /*return*/];
            }
        });
    });
}
// Run setup
main().catch(function (err) {
    log("\n\u2717 Error: ".concat(err.message), "red");
    process.exit(1);
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
