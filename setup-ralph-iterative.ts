#!/usr/bin/env bun
/**
 * Ralph Iterative Plugin Setup Script
 *
 * Automatically symlinks Ralph Iterative commands and skills
 * to the Claude Code plugin directory.
 */

import { $ } from "bun"
import { existsSync, mkdirSync, readlinkSync, symlinkSync } from "node:fs"
import { join, dirname } from "node:path"

// Configuration
const RALPH_REPO = "/root/repos/ralph"
const PLUGIN_DIR = join(RALPH_REPO, ".claude-plugin")
const COMMANDS_SOURCE = join(RALPH_REPO, "plugins/ralph-iterative/commands")
const SKILLS_SOURCE = join(RALPH_REPO, "plugins/ralph-iterative/skills")

const COMMANDS_TARGET = join(PLUGIN_DIR, "commands")
const SKILLS_TARGET = join(PLUGIN_DIR, "skills")

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
}

function log(message: string, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function symlinkFile(source: string, target: string): boolean {
  try {
    // Remove existing symlink/file if present
    if (existsSync(target)) {
      $`rm ${target}`
    }
    symlinkSync(source, target)
    return true
  } catch (error) {
    log(`  ✗ Failed to symlink ${source}: ${(error as Error).message}`, "red")
    return false
  }
}

async function setupCommands(): Promise<number> {
  log("\n=== Setting up Commands ===", "blue")

  // Ensure target directory exists
  mkdirSync(COMMANDS_TARGET, { recursive: true })

  const files = await $`ls ${COMMANDS_SOURCE}/*.md`.text() as string
  const commands = files.split("\n").filter(f => f.endsWith(".md"))

  let successCount = 0

  for (const file of commands) {
    const filename = file.split("/").pop()!
    const target = join(COMMANDS_TARGET, filename)

    if (symlinkFile(file, target)) {
      log(`  ✓ ${filename}`, "green")
      successCount++
    }
  }

  log(`\nLinked ${successCount}/${commands.length} commands`, "yellow")
  return successCount
}

async function setupSkills(): Promise<number> {
  log("\n=== Setting up Skills ===", "blue")

  // Ensure target directory exists
  mkdirSync(SKILLS_TARGET, { recursive: true })

  const dirs = await $`ls -d ${SKILLS_SOURCE}/*/`.text() as string
  const skills = dirs.split("\n").filter(d => d.trim().length > 0)

  let successCount = 0

  for (const dir of skills) {
    const dirname = dir.split("/").filter(Boolean).pop()!
    const target = join(SKILLS_TARGET, dirname)

    if (symlinkFile(dir.trim(), target)) {
      log(`  ✓ ${dirname}`, "green")
      successCount++
    }
  }

  log(`\nLinked ${successCount}/${skills.length} skills`, "yellow")
  return successCount
}

function verifySettings(): boolean {
  log("\n=== Verifying Claude Settings ===", "blue")

  const settingsPath = "/root/.claude/settings.json"

  if (!existsSync(settingsPath)) {
    log("  ✗ settings.json not found", "red")
    log(`    Expected: ${settingsPath}`, "yellow")
    return false
  }

  const settings = await $`cat ${settingsPath}`.text() as string
  const settingsJson = JSON.parse(settings)

  const pluginDir = settingsJson["plugin-dir"]

  if (!pluginDir) {
    log("  ✗ plugin-dir not set in settings.json", "red")
    log(`    Add: "plugin-dir": ["${PLUGIN_DIR}"]`, "yellow")
    return false
  }

  if (pluginDir.includes(PLUGIN_DIR)) {
    log(`  ✓ plugin-dir correctly set to ${PLUGIN_DIR}`, "green")
    return true
  }

  log(`  ! plugin-dir set to ${pluginDir}`, "yellow")
  log(`    Consider updating to: ${PLUGIN_DIR}`, "yellow")
  return true
}

function verifyInstallation(): void {
  log("\n=== Verifying Installation ===", "blue")

  // Check commands
  const commands = $`ls ${COMMANDS_TARGET}`.text() as string
  const commandList = commands.split("\n").filter(f => f.endsWith(".md"))

  log(`  Commands: ${commandList.length} found`, commandList.length > 0 ? "green" : "red")

  // Check skills
  const skills = $`ls ${SKILLS_TARGET}`.text() as string
  const skillList = skills.split("\n").filter(f => f.trim().length > 0)

  log(`  Skills: ${skillList.length} found`, skillList.length > 0 ? "green" : "red")

  // Show available commands
  if (commandList.length > 0) {
    log("\n  Available commands:", "blue")
    for (const cmd of commandList) {
      const name = cmd.replace(".md", "")
      log(`    /${name}`, "green")
    }
  }
}

async function main() {
  log("\n" + "=".repeat(50), "blue")
  log("  Ralph Iterative Plugin Setup", "bold")
  log("=".repeat(50), "blue")

  // Check if ralph repo exists
  if (!existsSync(RALPH_REPO)) {
    log(`\n✗ Ralph repo not found at ${RALPH_REPO}`, "red")
    log("  Clone ralph repo first:", "yellow")
    log(`  git clone https://github.com/ebowwa/ralph.git ${RALPH_REPO}`, "yellow")
    process.exit(1)
  }

  // Setup commands and skills
  const commandsCount = await setupCommands()
  const skillsCount = await setupSkills()

  // Verify settings
  const settingsOk = verifySettings()

  // Verify installation
  verifyInstallation()

  // Summary
  log("\n" + "=".repeat(50), "blue")
  log("  Setup Complete!", "green")
  log("=".repeat(50), "blue")
  log(`\n  Commands linked: ${commandsCount}`, "green")
  log(`  Skills linked: ${skillsCount}`, "green")
  log(`  Settings verified: ${settingsOk ? "✓" : "!"}`, settingsOk ? "green" : "yellow")

  log("\n  Usage:", "blue")
  log(`    doppler run --project seed --config prd -- claude '/go "task" --completion-promise DONE' -p`, "yellow")

  log("\n")
}

// Run setup
main().catch(err => {
  log(`\n✗ Error: ${err.message}`, "red")
  process.exit(1)
})
