"use strict";
/**
 * Package Manager Installation
 * Handles Homebrew, apt, yum, and other package managers
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installPackages = installPackages;
/**
 * Install the appropriate package manager for the OS
 */
function installPackages(env_1) {
    return __awaiter(this, arguments, void 0, function (env, options) {
        var os, hasSudo, isRoot, _a;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    os = env.os, hasSudo = env.hasSudo, isRoot = env.isRoot;
                    // Check if we can install packages
                    if (!isRoot && !hasSudo && os === "linux") {
                        console.warn("⚠ No sudo access, skipping package manager installation");
                        return [2 /*return*/, null];
                    }
                    _a = os;
                    switch (_a) {
                        case "macos": return [3 /*break*/, 1];
                        case "linux": return [3 /*break*/, 3];
                        case "windows": return [3 /*break*/, 5];
                    }
                    return [3 /*break*/, 6];
                case 1: return [4 /*yield*/, installHomebrew(env, options)];
                case 2: return [2 /*return*/, _b.sent()];
                case 3: return [4 /*yield*/, detectAndInstallLinuxPackageManager(env, options)];
                case 4: return [2 /*return*/, _b.sent()];
                case 5:
                    console.warn("⚠ Windows not fully supported yet");
                    return [2 /*return*/, null];
                case 6: throw new Error("Unsupported OS: ".concat(os));
            }
        });
    });
}
// ============================================================================
// Homebrew (macOS)
// ============================================================================
function installHomebrew(env, options) {
    return __awaiter(this, void 0, void 0, function () {
        var installCmd, proc, exitCode, homebrewPaths, _i, homebrewPaths_1, path;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, isHomebrewInstalled()];
                case 1:
                    // Check if Homebrew is already installed
                    if (_b.sent()) {
                        console.log("✓ Homebrew already installed");
                        return [2 /*return*/, createHomebrewManager()];
                    }
                    console.log("Installing Homebrew...");
                    if (options.dryRun) {
                        console.log("[dry-run] Would install Homebrew");
                        return [2 /*return*/, createHomebrewManager()];
                    }
                    installCmd = "\n    set -e\n    NONINTERACTIVE=1\n    bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"\n  ";
                    proc = Bun.spawn(["bash", "-c", installCmd], {
                        stdout: "inherit",
                        stderr: "inherit",
                        env: __assign(__assign({}, process.env), { NONINTERACTIVE: "1" }),
                    });
                    return [4 /*yield*/, proc.exited];
                case 2:
                    exitCode = _b.sent();
                    if (exitCode !== 0) {
                        throw new Error("Homebrew installation failed");
                    }
                    console.log("✓ Homebrew installed");
                    homebrewPaths = [
                        "/opt/homebrew/bin",
                        "/usr/local/bin",
                        "/home/linuxbrew/.linuxbrew/bin",
                    ];
                    for (_i = 0, homebrewPaths_1 = homebrewPaths; _i < homebrewPaths_1.length; _i++) {
                        path = homebrewPaths_1[_i];
                        if (!((_a = process.env.PATH) === null || _a === void 0 ? void 0 : _a.includes(path))) {
                            process.env.PATH = "".concat(path, ":").concat(process.env.PATH || "");
                        }
                    }
                    return [2 /*return*/, createHomebrewManager()];
            }
        });
    });
}
function isHomebrewInstalled() {
    return __awaiter(this, void 0, void 0, function () {
        var proc, exitCode, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    proc = Bun.spawn(["brew", "--version"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 1:
                    exitCode = _b.sent();
                    return [2 /*return*/, exitCode === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createHomebrewManager() {
    return {
        name: "brew",
        install: function (packages) {
            return __awaiter(this, void 0, void 0, function () {
                var cmd, proc, exitCode;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            cmd = __spreadArray(["brew", "install"], packages, true);
                            proc = Bun.spawn(cmd, {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            exitCode = _a.sent();
                            if (exitCode !== 0) {
                                throw new Error("Failed to install: ".concat(packages.join(", ")));
                            }
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function () {
            return __awaiter(this, void 0, void 0, function () {
                var proc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(["brew", "update"], {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        installed: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, isHomebrewInstalled()];
                });
            });
        },
    };
}
// ============================================================================
// Linux Package Managers (apt, yum, dnf, etc.)
// ============================================================================
function detectAndInstallLinuxPackageManager(env, options) {
    return __awaiter(this, void 0, void 0, function () {
        var managers, _i, managers_1, manager;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    managers = [
                        { name: "apt", check: isAptAvailable, create: createAptManager },
                        { name: "yum", check: isYumAvailable, create: createYumManager },
                        { name: "dnf", check: isDnfAvailable, create: createDnfManager },
                        { name: "pacman", check: isPacmanAvailable, create: createPacmanManager },
                        { name: "zypper", check: isZypperAvailable, create: createZypperManager },
                    ];
                    _i = 0, managers_1 = managers;
                    _a.label = 1;
                case 1:
                    if (!(_i < managers_1.length)) return [3 /*break*/, 4];
                    manager = managers_1[_i];
                    return [4 /*yield*/, manager.check()];
                case 2:
                    if (_a.sent()) {
                        console.log("\u2713 Found ".concat(manager.name));
                        return [2 /*return*/, manager.create()];
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: 
                // No package manager found, this is unusual for Linux
                throw new Error("No supported package manager found");
            }
        });
    });
}
function isAptAvailable() {
    return __awaiter(this, void 0, void 0, function () {
        var proc, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    proc = Bun.spawn(["which", "apt-get"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 1: return [2 /*return*/, (_b.sent()) === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createAptManager() {
    return {
        name: "apt",
        install: function (packages) {
            return __awaiter(this, void 0, void 0, function () {
                var proc, exitCode;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: 
                        // Update first
                        return [4 /*yield*/, this.update()];
                        case 1:
                            // Update first
                            _a.sent();
                            proc = Bun.spawn(__spreadArray([
                                "sudo",
                                "DEBIAN_FRONTEND=noninteractive",
                                "apt-get",
                                "install",
                                "-y"
                            ], packages, true), {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 2:
                            exitCode = _a.sent();
                            if (exitCode !== 0) {
                                throw new Error("Failed to install: ".concat(packages.join(", ")));
                            }
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function () {
            return __awaiter(this, void 0, void 0, function () {
                var proc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(["sudo", "apt-get", "update", "-qq"], {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        installed: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, isAptAvailable()];
                });
            });
        },
    };
}
function isYumAvailable() {
    return __awaiter(this, void 0, void 0, function () {
        var proc, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    proc = Bun.spawn(["which", "yum"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 1: return [2 /*return*/, (_b.sent()) === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createYumManager() {
    return {
        name: "yum",
        install: function (packages) {
            return __awaiter(this, void 0, void 0, function () {
                var proc, exitCode;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(__spreadArray(["sudo", "yum", "install", "-y"], packages, true), {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            exitCode = _a.sent();
                            if (exitCode !== 0) {
                                throw new Error("Failed to install: ".concat(packages.join(", ")));
                            }
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function () {
            return __awaiter(this, void 0, void 0, function () {
                var proc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(["sudo", "yum", "check-update", "-q"], {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        installed: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, isYumAvailable()];
                });
            });
        },
    };
}
function isDnfAvailable() {
    return __awaiter(this, void 0, void 0, function () {
        var proc, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    proc = Bun.spawn(["which", "dnf"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 1: return [2 /*return*/, (_b.sent()) === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createDnfManager() {
    return {
        name: "dnf",
        install: function (packages) {
            return __awaiter(this, void 0, void 0, function () {
                var proc, exitCode;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(__spreadArray(["sudo", "dnf", "install", "-y"], packages, true), {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            exitCode = _a.sent();
                            if (exitCode !== 0) {
                                throw new Error("Failed to install: ".concat(packages.join(", ")));
                            }
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function () {
            return __awaiter(this, void 0, void 0, function () {
                var proc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(["sudo", "dnf", "check-update", "-q"], {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        installed: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, isDnfAvailable()];
                });
            });
        },
    };
}
function isPacmanAvailable() {
    return __awaiter(this, void 0, void 0, function () {
        var proc, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    proc = Bun.spawn(["which", "pacman"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 1: return [2 /*return*/, (_b.sent()) === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createPacmanManager() {
    return {
        name: "pacman",
        install: function (packages) {
            return __awaiter(this, void 0, void 0, function () {
                var proc, exitCode;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(__spreadArray(["sudo", "pacman", "-S", "--noconfirm"], packages, true), {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            exitCode = _a.sent();
                            if (exitCode !== 0) {
                                throw new Error("Failed to install: ".concat(packages.join(", ")));
                            }
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function () {
            return __awaiter(this, void 0, void 0, function () {
                var proc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(["sudo", "pacman", "-Sy"], {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        installed: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, isPacmanAvailable()];
                });
            });
        },
    };
}
function isZypperAvailable() {
    return __awaiter(this, void 0, void 0, function () {
        var proc, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    proc = Bun.spawn(["which", "zypper"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 1: return [2 /*return*/, (_b.sent()) === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createZypperManager() {
    return {
        name: "zypper",
        install: function (packages) {
            return __awaiter(this, void 0, void 0, function () {
                var proc, exitCode;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(__spreadArray(["sudo", "zypper", "install", "-y"], packages, true), {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            exitCode = _a.sent();
                            if (exitCode !== 0) {
                                throw new Error("Failed to install: ".concat(packages.join(", ")));
                            }
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function () {
            return __awaiter(this, void 0, void 0, function () {
                var proc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            proc = Bun.spawn(["sudo", "zypper", "refresh"], {
                                stdout: "inherit",
                                stderr: "inherit",
                            });
                            return [4 /*yield*/, proc.exited];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        installed: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, isZypperAvailable()];
                });
            });
        },
    };
}
