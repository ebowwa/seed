"use strict";
/**
 * Environment Detection
 * Detects OS, platform, environment type, and system capabilities
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
exports.detectEnvironment = detectEnvironment;
/**
 * Detect the current environment
 */
function detectEnvironment() {
    return __awaiter(this, void 0, void 0, function () {
        var os, arch, platform, type, isRoot, hasSudo, hasDocker, ci, isCodespaces, isContainer, containerType, _a, isVPS, vpsProvider, _b, homeDir, configDir, cacheDir, binDir;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    os = detectOS();
                    arch = detectArch();
                    platform = process.platform;
                    type = detectEnvironmentType();
                    isRoot = ((_c = process.getuid) === null || _c === void 0 ? void 0 : _c.call(process)) === 0 || process.env.USER === "root";
                    return [4 /*yield*/, checkSudo()];
                case 1:
                    hasSudo = _d.sent();
                    return [4 /*yield*/, checkDocker()];
                case 2:
                    hasDocker = _d.sent();
                    ci = detectCI();
                    isCodespaces = detectCodespaces();
                    return [4 /*yield*/, detectContainer()];
                case 3:
                    isContainer = _d.sent();
                    if (!isContainer) return [3 /*break*/, 5];
                    return [4 /*yield*/, detectContainerType()];
                case 4:
                    _a = _d.sent();
                    return [3 /*break*/, 6];
                case 5:
                    _a = undefined;
                    _d.label = 6;
                case 6:
                    containerType = _a;
                    return [4 /*yield*/, detectVPS()];
                case 7:
                    isVPS = _d.sent();
                    if (!isVPS) return [3 /*break*/, 9];
                    return [4 /*yield*/, detectVPSProvider()];
                case 8:
                    _b = _d.sent();
                    return [3 /*break*/, 10];
                case 9:
                    _b = undefined;
                    _d.label = 10;
                case 10:
                    vpsProvider = _b;
                    homeDir = process.env.HOME ||
                        process.env.USERPROFILE ||
                        (process.platform === "win32"
                            ? process.env.USERPROFILE || ""
                            : "/home/".concat(process.env.USER || "root"));
                    configDir = process.env.XDG_CONFIG_HOME ||
                        "".concat(homeDir, "/.config");
                    cacheDir = process.env.XDG_CACHE_HOME ||
                        "".concat(homeDir, "/.cache");
                    if (os === "macos") {
                        binDir = "/usr/local/bin";
                    }
                    else if (isRoot) {
                        binDir = "/usr/local/bin";
                    }
                    else {
                        binDir = "".concat(homeDir, "/.local/bin");
                    }
                    return [2 /*return*/, {
                            os: os,
                            arch: arch,
                            platform: platform,
                            type: type,
                            hasSudo: hasSudo,
                            isRoot: isRoot,
                            hasDocker: hasDocker,
                            homeDir: homeDir,
                            cacheDir: cacheDir,
                            configDir: configDir,
                            binDir: binDir,
                            ci: ci,
                            isCodespaces: isCodespaces,
                            isContainer: isContainer,
                            containerType: containerType,
                            isVPS: isVPS,
                            vpsProvider: vpsProvider,
                        }];
            }
        });
    });
}
// ============================================================================
// Detection Functions
// ============================================================================
function detectOS() {
    var platform = process.platform;
    switch (platform) {
        case "darwin":
            return "macos";
        case "linux":
            return "linux";
        case "win32":
            return "windows";
        default:
            throw new Error("Unsupported OS: ".concat(platform));
    }
}
function detectArch() {
    var arch = process.arch;
    switch (arch) {
        case "x64":
        case "ia32":
            return "x64";
        case "arm64":
        case "aarch64":
            return "arm64";
        default:
            throw new Error("Unsupported architecture: ".concat(arch));
    }
}
function detectEnvironmentType() {
    // Check for Codespaces first (GitHub cloud dev environment)
    if (process.env.CODESPACES === "true") {
        return "codespaces";
    }
    // Check for CI environment
    if (process.env.CI === "true") {
        return "ci";
    }
    // Check if we're in a container (without the async container detection)
    if (process.env.container ||
        process.env.KUBERNETES_SERVICE_HOST ||
        process.env.DOCKER_CONTAINER) {
        return "container";
    }
    // Check VPS indicators (cloud metadata services)
    if (process.env.HETZNER_IP ||
        process.env.AWS_REGION ||
        process.env.GCP_REGION ||
        process.env.AZURE_REGION) {
        return "vps";
    }
    // Default to local for desktop development
    // (we'll do async detection later for more accuracy)
    return "local";
}
function checkSudo() {
    return __awaiter(this, void 0, void 0, function () {
        var result, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Bun.spawn(["sudo", "-n", "true"], {
                            stdout: "pipe",
                            stderr: "pipe",
                        }).exited];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, result === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function checkDocker() {
    return __awaiter(this, void 0, void 0, function () {
        var result, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Bun.spawn(["docker", "--version"], {
                            stdout: "pipe",
                            stderr: "pipe",
                        }).exited];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, result === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function detectCI() {
    if (!process.env.CI)
        return null;
    if (process.env.GITHUB_ACTIONS)
        return "github";
    if (process.env.GITLAB_CI)
        return "gitlab";
    if (process.env.CIRCLECI)
        return "circleci";
    if (process.env.TRAVIS)
        return "travis";
    if (process.env.JENKINS_URL)
        return "jenkins";
    if (process.env.TF_BUILD)
        return "azure";
    return null;
}
function detectCodespaces() {
    return process.env.CODESPACES === "true" || process.env.CODESPACES === "1";
}
function detectContainer() {
    return __awaiter(this, void 0, void 0, function () {
        var proc, exitCode, _a, proc, exitCode, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    // Check for container indicators
                    if (process.env.container === "docker")
                        return [2 /*return*/, true];
                    if (process.env.KUBERNETES_SERVICE_HOST)
                        return [2 /*return*/, true];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    proc = Bun.spawn(["test", "-f", "/.dockerenv"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 2:
                    exitCode = _c.sent();
                    if (exitCode === 0)
                        return [2 /*return*/, true];
                    return [3 /*break*/, 4];
                case 3:
                    _a = _c.sent();
                    return [3 /*break*/, 4];
                case 4:
                    _c.trys.push([4, 6, , 7]);
                    proc = Bun.spawn([
                        "grep",
                        "-q",
                        "docker",
                        "/proc/1/cgroup",
                    ], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 5:
                    exitCode = _c.sent();
                    if (exitCode === 0)
                        return [2 /*return*/, true];
                    return [3 /*break*/, 7];
                case 6:
                    _b = _c.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, false];
            }
        });
    });
}
function detectContainerType() {
    return __awaiter(this, void 0, void 0, function () {
        var proc, exitCode, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (process.env.KUBERNETES_SERVICE_HOST)
                        return [2 /*return*/, "kubernetes"];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    proc = Bun.spawn(["which", "podman"], {
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, proc.exited];
                case 2:
                    exitCode = _b.sent();
                    if (exitCode === 0)
                        return [2 /*return*/, "podman"];
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, "docker"]; // Default to docker for containers
            }
        });
    });
}
function detectVPS() {
    return __awaiter(this, void 0, void 0, function () {
        var indicators, _i, indicators_1, indicator;
        return __generator(this, function (_a) {
            indicators = [
                "HETZNER_IP",
                "HETZNER",
                "AWS_REGION",
                "AWS_DEFAULT_REGION",
                "GCP_REGION",
                "GOOGLE_CLOUD_PROJECT",
                "AZURE_REGION",
                "AZURE_LOCATION",
                "DIGITALOCEAN_DROPLET_ID",
                "LINODE_ID",
                "VULTR_INSTANCE_ID",
            ];
            for (_i = 0, indicators_1 = indicators; _i < indicators_1.length; _i++) {
                indicator = indicators_1[_i];
                if (process.env[indicator])
                    return [2 /*return*/, true];
            }
            // Try to detect by checking for common cloud metadata services
            // (this is async but we'll do a simple check)
            return [2 /*return*/, false];
        });
    });
}
function detectVPSProvider() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (process.env.HETZNER_IP || process.env.HETZNER)
                return [2 /*return*/, "hetzner"];
            if (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION)
                return [2 /*return*/, "aws"];
            if (process.env.GCP_REGION || process.env.GOOGLE_CLOUD_PROJECT)
                return [2 /*return*/, "gcp"];
            if (process.env.AZURE_REGION || process.env.AZURE_LOCATION)
                return [2 /*return*/, "azure"];
            if (process.env.DIGITALOCEAN_DROPLET_ID)
                return [2 /*return*/, "digitalocean"];
            if (process.env.LINODE_ID)
                return [2 /*return*/, "linode"];
            if (process.env.VULTR_INSTANCE_ID)
                return [2 /*return*/, "vultr"];
            return [2 /*return*/, "unknown"];
        });
    });
}
