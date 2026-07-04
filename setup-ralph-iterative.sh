#!/bin/bash
# Ralph Iterative Plugin Setup Script
# Symlinks commands and skills to Claude Code plugin directory

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
RALPH_REPO="${RALPH_REPO:-/root/repos/ralph}"
PLUGIN_DIR="${RALPH_REPO}/.claude-plugin"
COMMANDS_SOURCE="${RALPH_REPO}/plugins/ralph-iterative/commands"
SKILLS_SOURCE="${RALPH_REPO}/plugins/ralph-iterative/skills"
COMMANDS_TARGET="${PLUGIN_DIR}/commands"
SKILLS_TARGET="${PLUGIN_DIR}/skills"

log() {
  echo -e "${2}$1${NC}"
}

log_header() {
  echo -e "\n${BLUE}==================================================${NC}"
  echo -e "${BOLD}  Ralph Iterative Plugin Setup${NC}"
  echo -e "${BLUE}==================================================${NC}\n"
}

setup_commands() {
  log "=== Setting up Commands ===" "$BLUE"

  # Ensure target directory exists
  mkdir -p "${COMMANDS_TARGET}"

  local count=0
  for file in "${COMMANDS_SOURCE}"/*.md; do
    if [[ -f "$file" ]]; then
      local filename
      filename=$(basename "$file")
      local target="${COMMANDS_TARGET}/${filename}"

      # Remove existing symlink
      [[ -e "$target" ]] && rm "$target"

      # Create symlink
      ln -s "$file" "$target"
      log "  ✓ ${filename}" "$GREEN"
      ((count++))
    fi
  done

  log "" ""
  log "Linked ${count} commands" "$YELLOW"
}

setup_skills() {
  log "=== Setting up Skills ===" "$BLUE"

  # Ensure target directory exists
  mkdir -p "${SKILLS_TARGET}"

  local count=0
  for dir in "${SKILLS_SOURCE}"/*/; do
    if [[ -d "$dir" ]]; then
      local dirname
      dirname=$(basename "$dir")
      local target="${SKILLS_TARGET}/${dirname}"

      # Remove existing symlink
      [[ -e "$target" ]] && rm "$target"

      # Create symlink
      ln -s "$dir" "$target"
      log "  ✓ ${dirname}" "$GREEN"
      ((count++))
    fi
  done

  log "" ""
  log "Linked ${count} skills" "$YELLOW"
}

verify_settings() {
  log "=== Verifying Claude Settings ===" "$BLUE"

  local settings_path="/root/.claude/settings.json"

  if [[ ! -f "$settings_path" ]]; then
    log "  ✗ settings.json not found" "$RED"
    log "    Expected: ${settings_path}" "$YELLOW"
    return 1
  fi

  if grep -q "plugin-dir" "$settings_path"; then
    if grep -q "${PLUGIN_DIR}" "$settings_path"; then
      log "  ✓ plugin-dir correctly set" "$GREEN"
      return 0
    else
      log "  ! plugin-dir set but may need update" "$YELLOW"
      log "    Current: $(grep plugin-dir "$settings_path" | head -1)" "$YELLOW"
      return 0
    fi
  else
    log "  ! plugin-dir not set in settings.json" "$YELLOW"
    log "    Add: \"plugin-dir\": [\"${PLUGIN_DIR}\"]" "$YELLOW"
    return 0
  fi
}

verify_installation() {
  log "=== Verifying Installation ===" "$BLUE"

  local commands_count
  commands_count=$(ls "${COMMANDS_TARGET}" 2>/dev/null | wc -l)

  local skills_count
  skills_count=$(ls "${SKILLS_TARGET}" 2>/dev/null | wc -l)

  log "  Commands: ${commands_count} found" "$GREEN"
  log "  Skills: ${skills_count} found" "$GREEN"

  # Show available commands
  if [[ $commands_count -gt 0 ]]; then
    log "" ""
    log "  Available commands:" "$BLUE"
    for cmd in "${COMMANDS_TARGET}"/*.md; do
      if [[ -f "$cmd" ]]; then
        local name
        name=$(basename "$cmd" .md)
        log "    /${name}" "$GREEN"
      fi
    done
  fi
}

show_usage() {
  log "" ""
  log "  Usage:" "$BLUE"
  log "    doppler run --project seed --config prd -- claude '/go \"task\" --completion-promise DONE' -p" "$YELLOW"
  log "" ""
}

main() {
  log_header

  # Check if ralph repo exists
  if [[ ! -d "$RALPH_REPO" ]]; then
    log "✗ Ralph repo not found at ${RALPH_REPO}" "$RED"
    log "  Clone ralph repo first:" "$YELLOW"
    log "  git clone https://github.com/ebowwa/ralph.git ${RALPH_REPO}" "$YELLOW"
    exit 1
  fi

  # Setup commands and skills
  setup_commands
  setup_skills

  # Verify settings
  verify_settings

  # Verify installation
  verify_installation

  # Summary
  echo -e "\n${BLUE}==================================================${NC}"
  log "  Setup Complete!" "$GREEN"
  echo -e "${BLUE}==================================================${NC}"

  show_usage
}

# Run main
main "$@"
