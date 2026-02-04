"use strict";
// Telegram Bot API Client Service
// Implements long-polling for inbound messages, sendMessage for outbound
// Based on clawdbot's exponential backoff approach for error handling
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
exports.TelegramService = void 0;
// Configuration
var TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
var TELEGRAM_CHAT_ID = parseInt(process.env.TELEGRAM_CHAT_ID || "", 10);
var TELEGRAM_API_URL = "https://api.telegram.org/bot".concat(TELEGRAM_BOT_TOKEN);
var OFFSET_FILE_PATH = "".concat(process.env.HOME || "", "/.node-agent/telegram-offset");
// Polling configuration
var POLL_TIMEOUT = 30; // seconds - long poll timeout
var MAX_BACKOFF_MS = 30000; // 30 seconds max backoff
var INITIAL_BACKOFF_MS = 2000; // 2 seconds initial backoff
var BACKOFF_MULTIPLIER = 1.8;
var JITTER_PERCENT = 0.25; // 25% jitter
var TelegramService = /** @class */ (function () {
    function TelegramService() {
        this.offset = 0;
        this.isPolling = false;
        this.currentBackoff = INITIAL_BACKOFF_MS;
        if (!TELEGRAM_BOT_TOKEN) {
            throw new Error("TELEGRAM_BOT_TOKEN is required");
        }
        if (!TELEGRAM_CHAT_ID) {
            throw new Error("TELEGRAM_CHAT_ID is required");
        }
        this.token = TELEGRAM_BOT_TOKEN;
        this.allowedChatId = TELEGRAM_CHAT_ID;
        this.apiUrl = TELEGRAM_API_URL;
        // Load offset from file if exists
        this.loadOffset();
    }
    /**
     * Load the last processed update_id from disk
     */
    TelegramService.prototype.loadOffset = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fsp, offsetData, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("fs"); })];
                    case 1:
                        fsp = (_b.sent()).promises;
                        return [4 /*yield*/, fsp.readFile(OFFSET_FILE_PATH, "utf-8")];
                    case 2:
                        offsetData = _b.sent();
                        this.offset = parseInt(offsetData.trim(), 10);
                        console.log("[TelegramService] Loaded offset: ".concat(this.offset));
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        // File doesn't exist or is invalid, start from 0
                        this.offset = 0;
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save the current offset to disk
     */
    TelegramService.prototype.saveOffset = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fsp, homeDir, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("fs"); })];
                    case 1:
                        fsp = (_a.sent()).promises;
                        homeDir = process.env.HOME || "";
                        return [4 /*yield*/, fsp.mkdir("".concat(homeDir, "/.node-agent"), { recursive: true })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, fsp.writeFile(OFFSET_FILE_PATH, this.offset.toString(), "utf-8")];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error("[TelegramService] Failed to save offset:", error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate backoff with jitter (mirrors clawdbot's approach)
     */
    TelegramService.prototype.calculateBackoff = function (currentAttempt) {
        var baseBackoff = Math.min(INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, currentAttempt), MAX_BACKOFF_MS);
        var jitter = baseBackoff * JITTER_PERCENT * (Math.random() * 2 - 1);
        return Math.max(INITIAL_BACKOFF_MS, baseBackoff + jitter);
    };
    /**
     * Sleep for a specified duration
     */
    TelegramService.prototype.sleep = function (ms) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) { return setTimeout(resolve, ms); })];
            });
        });
    };
    /**
     * Make a request to the Telegram Bot API
     */
    TelegramService.prototype.apiRequest = function (method, params) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, errorText, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.apiUrl, "/").concat(method);
                        return [4 /*yield*/, fetch(url, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(params),
                            })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        errorText = _a.sent();
                        throw new Error("Telegram API error: ".concat(response.status, " ").concat(errorText));
                    case 3: return [4 /*yield*/, response.json()];
                    case 4:
                        data = _a.sent();
                        if (!data.ok) {
                            throw new Error("Telegram API error: ".concat(data.description || "Unknown error"));
                        }
                        return [2 /*return*/, data.result];
                }
            });
        });
    };
    /**
     * Get updates from Telegram (long polling)
     */
    TelegramService.prototype.getUpdates = function () {
        return __awaiter(this, arguments, void 0, function (timeout) {
            var params, result, error_2;
            if (timeout === void 0) { timeout = POLL_TIMEOUT; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        params = {
                            timeout: timeout,
                            offset: this.offset > 0 ? this.offset + 1 : undefined,
                        };
                        return [4 /*yield*/, this.apiRequest("getUpdates", params)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 2:
                        error_2 = _a.sent();
                        if (error_2 instanceof Error) {
                            throw new Error("Failed to get updates: ".concat(error_2.message));
                        }
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send a message to Telegram
     */
    TelegramService.prototype.sendMessage = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Validate chat_id is allowed
                        if (params.chat_id !== this.allowedChatId) {
                            throw new Error("Chat ID ".concat(params.chat_id, " is not in the allowlist"));
                        }
                        return [4 /*yield*/, this.apiRequest("sendMessage", {
                                chat_id: params.chat_id,
                                text: params.text,
                                parse_mode: params.parse_mode,
                                disable_web_page_preview: params.disable_web_page_preview,
                                reply_to_message_id: params.reply_to_message_id,
                            })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Send a text message to the allowed chat
     */
    TelegramService.prototype.sendText = function (text, options) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                return [2 /*return*/, this.sendMessage({
                        chat_id: this.allowedChatId,
                        text: text,
                        parse_mode: (options === null || options === void 0 ? void 0 : options.parse_mode) || "Markdown",
                        disable_web_page_preview: (_a = options === null || options === void 0 ? void 0 : options.disable_web_page_preview) !== null && _a !== void 0 ? _a : true,
                        reply_to_message_id: options === null || options === void 0 ? void 0 : options.reply_to_message_id,
                    })];
            });
        });
    };
    /**
     * Parse a command from a Telegram message
     */
    TelegramService.prototype.parseCommand = function (message) {
        // Only process messages from allowed chat
        if (message.chat.id !== this.allowedChatId) {
            return null;
        }
        var text = message.text || "";
        var parts = text.trim().split(/\s+/);
        var command = parts[0];
        // Check if it's a command (starts with /)
        if (!command.startsWith("/")) {
            return {
                command: "chat",
                args: parts,
                raw_text: text,
                chat_id: message.chat.id,
                message_id: message.message_id,
                user_id: message.from.id,
            };
        }
        // Extract command name (remove /)
        var commandName = command.slice(1);
        var args = parts.slice(1);
        return {
            command: commandName,
            args: args,
            raw_text: text,
            chat_id: message.chat.id,
            message_id: message.message_id,
            user_id: message.from.id,
        };
    };
    /**
     * Start polling for updates (long polling)
     */
    TelegramService.prototype.startPolling = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var errorCount, updates, _i, updates_1, update, error_3, backoff;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.isPolling) {
                            throw new Error("Polling is already active");
                        }
                        this.isPolling = true;
                        errorCount = 0;
                        console.log("[TelegramService] Starting long-polling loop");
                        _b.label = 1;
                    case 1:
                        if (!this.isPolling) return [3 /*break*/, 12];
                        // Check for abort signal
                        if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                            console.log("[TelegramService] Polling aborted");
                            return [3 /*break*/, 12];
                        }
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 9, , 11]);
                        return [4 /*yield*/, this.getUpdates(POLL_TIMEOUT)];
                    case 3:
                        updates = _b.sent();
                        // Reset backoff on success
                        errorCount = 0;
                        this.currentBackoff = INITIAL_BACKOFF_MS;
                        _i = 0, updates_1 = updates;
                        _b.label = 4;
                    case 4:
                        if (!(_i < updates_1.length)) return [3 /*break*/, 8];
                        update = updates_1[_i];
                        // Update offset
                        this.offset = update.update_id;
                        return [4 /*yield*/, this.saveOffset()];
                    case 5:
                        _b.sent();
                        // Process update
                        return [4 /*yield*/, options.onUpdate(update)];
                    case 6:
                        // Process update
                        _b.sent();
                        _b.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 4];
                    case 8: return [3 /*break*/, 11];
                    case 9:
                        error_3 = _b.sent();
                        errorCount++;
                        if (options.onError) {
                            options.onError(error_3 instanceof Error ? error_3 : new Error(String(error_3)));
                        }
                        backoff = this.calculateBackoff(errorCount);
                        console.error("[TelegramService] Error polling (attempt ".concat(errorCount, "), retrying in ").concat(Math.round(backoff / 1000), "s:"), error_3);
                        return [4 /*yield*/, this.sleep(backoff)];
                    case 10:
                        _b.sent();
                        return [3 /*break*/, 11];
                    case 11: return [3 /*break*/, 1];
                    case 12:
                        this.isPolling = false;
                        console.log("[TelegramService] Polling stopped");
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stop polling for updates
     */
    TelegramService.prototype.stopPolling = function () {
        this.isPolling = false;
        console.log("[TelegramService] Polling stop requested");
    };
    /**
     * Get the current polling state
     */
    TelegramService.prototype.getPollingState = function () {
        return {
            isPolling: this.isPolling,
            offset: this.offset,
        };
    };
    /**
     * Test the Telegram bot connection
     */
    TelegramService.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.apiRequest("getMe")];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, {
                                ok: true,
                                bot: {
                                    id: result.id,
                                    name: result.first_name,
                                    username: result.username,
                                },
                            }];
                    case 2:
                        error_4 = _a.sent();
                        return [2 /*return*/, {
                                ok: false,
                                bot: null,
                                error: error_4 instanceof Error ? error_4.message : String(error_4),
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return TelegramService;
}());
exports.TelegramService = TelegramService;
