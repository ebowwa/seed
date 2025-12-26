# Claude Code - New Changes

*Last checked: 2025-12-26*

## Version 2.0.74

### New Features
- **LSP Tool**: Added Language Server Protocol tool for code intelligence features like go-to-definition, find references, and hover documentation
- **Terminal Support**: `/terminal-setup` now supports Kitty, Alacritty, Zed, and Warp terminals
- **Syntax Highlighting**: Ctrl+T toggle, theme picker improvements

### Fixes
- Fixed skill `allowed-tools` not being applied to tools invoked by the skill
- Fixed Opus 4.5 tip incorrectly showing when user was already using Opus
- Fixed potential crash when syntax highlighting isn't initialized correctly
- Fixed macOS keyboard shortcuts to display 'opt' instead of 'alt'

### Improvements
- Improved `/context` command visualization with grouped skills and agents by source
- Windows: Fixed issue with improper rendering
- VSCode: Added gift tag pictogram for year-end promotion

## Version 2.0.73

### New Features
- Clickable `[Image #N]` links that open attached images in default viewer
- Alt+Y yank-pop to cycle through kill ring history after Ctrl+Y yank
- Search filtering in plugin discover screen
- Custom session IDs when forking sessions

### Fixes
- Fixed slow input history cycling and race condition
- Improved `/theme` command and theme picker UI

## Version 2.0.72

### New Features
- **Claude in Chrome (Beta)**: Control browser via Chrome extension (https://claude.ai/chrome)
- Reduced terminal flickering
- Scannable QR code for mobile app downloads
- Loading indicator when resuming conversations

### Fixes
- Fixed `/context` command not respecting custom system prompts
- Fixed order of consecutive Ctrl+K lines when pasting with Ctrl+Y

### Performance
- Improved @ mention file suggestion speed (~3x faster in git repositories)

## Version 2.0.71

### New Features
- `/config` toggle for prompt suggestions
- `/settings` alias for `/config` command

### Fixes
- Fixed @ file reference suggestions incorrectly triggering
- Fixed MCP servers from `.mcp.json` not loading with `--dangerously-skip-permissions`
- Fixed permission rules incorrectly rejecting valid bash glob patterns

## Version 2.0.70

### New Features
- Enter key accepts and submits prompt suggestions immediately (Tab still accepts for editing)
- Wildcard syntax `mcp__server__*` for MCP tool permissions
- Auto-update toggle for plugin marketplaces

### Performance
- **3x memory usage improvement** for large conversations
- Improved resolution of stats screenshots

### Fixes
- Fixed input being cleared when processing queued commands
- Fixed prompt suggestions replacing typed input
- Fixed diff view not updating when terminal is resized

## Version 2.0.64 - Major Async Update

### New Features
- **Async Agents**: Agents and bash commands can run asynchronously
- **Named Sessions**: `/rename` to name sessions, `/resume <name>` to resume
- **Stats Command**: `/stats` for usage stats and streaks
- **Rules Support**: `.claude/rules/` directory support

### Performance
- Instant auto-compacting

### Fixes
- Fixed auto-loading .env when using native installer
- Fixed `--system-prompt` being ignored with `--continue`/`--resume`

## Version 2.0.60

### New Features
- **Background Agents**: Agents run in background while you work
- `/mcp enable/disable [server-name]` quick toggle

## Version 2.0.51

### New Features
- **Opus 4.5** released
- **Claude Code for Desktop** launched
- Updated usage limits for Claude Code users
- Plan Mode improvements

## Version 2.0.20

### New Features
- **Claude Skills support** - modular capabilities

## Version 2.0.12

### New Features
- **Plugin System Released** - custom commands, agents, hooks, MCP servers

---

*This document is automatically updated by GitHub Actions and manual tracking. See [claude-code-tracked-versions.md](./claude-code-tracked-versions.md) for tracking history.*
