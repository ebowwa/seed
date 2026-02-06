#!/usr/bin/env bun
/**
 * Test script to verify rolling keys selection
 */
var _a;
// Simulate Doppler environment
process.env.ANTHROPIC_API_KEYS = JSON.stringify([
    "sk-ant-test-key-1",
    "sk-ant-test-key-2",
    "3c7d47cad69141a8b61b29ce35ae3a71.9tdh1k3tcvsRdhnt"
]);
console.log("Testing rolling keys selection...\n");
console.log("ANTHROPIC_API_KEYS:", process.env.ANTHROPIC_API_KEYS);
// Test the selection logic
var keysArray = process.env.ANTHROPIC_API_KEYS;
if (keysArray) {
    try {
        var keys = JSON.parse(keysArray);
        console.log("\nParsed keys:", keys);
        console.log("Key count:", keys.length);
        console.log("Selected key:", ((_a = keys[0]) === null || _a === void 0 ? void 0 : _a.substring(0, 20)) + "...");
        console.log("\n✅ Rolling keys parsing works!");
    }
    catch (e) {
        console.log("\n❌ Failed to parse:", e);
    }
}
