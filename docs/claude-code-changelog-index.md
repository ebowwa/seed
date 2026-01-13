
---

## 2.1.6 - 2026-01-13 18:12:24 UTC


- Added search functionality to `/config` command for quickly filtering settings
- Added Updates section to `/doctor` showing auto-update channel and available npm versions (stable/latest)
- Added date range filtering to `/stats` command - press `r` to cycle between Last 7 days, Last 30 days, and All time
- Added automatic discovery of skills from nested `.claude/skills` directories when working with files in subdirectories
- Added `context_window.used_percentage` and `context_window.remaining_percentage` fields to status line input for easier context window display
- Added an error display when the editor fails during Ctrl+G
- Fixed permission bypass via shell line continuation that could allow blocked commands to execute
- Fixed false "File has been unexpectedly modified" errors when file watchers touch files without changing content
- Fixed text styling (bold, colors) getting progressively misaligned in multi-line responses
- Fixed the feedback panel closing unexpectedly when typing 'n' in the description field
- Fixed rate limit warning appearing at low usage after weekly reset (now requires 70% usage)
- Fixed rate limit options menu incorrectly auto-opening when resuming a previous session
- Fixed numpad keys outputting escape sequences instead of characters in Kitty keyboard protocol terminals
- Fixed Option+Return not inserting newlines in Kitty keyboard protocol terminals
- Fixed corrupted config backup files accumulating in the home directory (now only one backup is created per config file)
- Fixed `mcp list` and `mcp get` commands leaving orphaned MCP server processes
- Fixed visual artifacts in ink2 mode when nodes become hidden via `display:none`
- Improved the external CLAUDE.md imports approval dialog to show which files are being imported and from where
- Improved the `/tasks` dialog to go directly to task details when there's only one background task running
- Improved @ autocomplete with icons for different suggestion types and single-line formatting
- Updated "Help improve Claude" setting fetch to refresh OAuth and retry when it fails due to a stale OAuth token
- Changed task notification display to cap at 3 lines with overflow summary when multiple background tasks complete simultaneously
- Changed terminal title to "Claude Code" on startup for better window identification
- Removed ability to @-mention MCP servers to enable/disable - use `/mcp enable <name>` instead
- [VSCode] Fixed usage indicator not updating after manual compact

## 2.1.5

- Added `CLAUDE_CODE_TMPDIR` environment variable to override the temp directory used for internal temp files, useful for environments with custom temp directory requirements


---

## 2.1.4 - 2026-01-11 18:10:13 UTC


- Added `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` environment variable to disable all background task functionality including auto-backgrounding and the Ctrl+B shortcut
- Fixed "Help improve Claude" setting fetch to refresh OAuth and retry when it fails due to a stale OAuth token


---

## 2.1.3 - 2026-01-10 18:10:09 UTC


- Merged slash commands and skills, simplifying the mental model with no change in behavior
- Added release channel (`stable` or `latest`) toggle to `/config`
- Added detection and warnings for unreachable permission rules, with warnings in `/doctor` and after saving rules that include the source of each rule and actionable fix guidance
- Fixed plan files persisting across `/clear` commands, now ensuring a fresh plan file is used after clearing a conversation
- Fixed false skill duplicate detection on filesystems with large inodes (e.g., ExFAT) by using 64-bit precision for inode values
- Fixed mismatch between background task count in status bar and items shown in tasks dialog
- Fixed sub-agents using the wrong model during conversation compaction
- Fixed web search in sub-agents using incorrect model
- Fixed trust dialog acceptance when running from the home directory not enabling trust-requiring features like hooks during the session
- Improved terminal rendering stability by preventing uncontrolled writes from corrupting cursor state
- Improved slash command suggestion readability by truncating long descriptions to 2 lines
- Changed tool hook execution timeout from 60 seconds to 10 minutes
- [VSCode] Added clickable destination selector for permission requests, allowing you to choose where settings are saved (this project, all projects, shared with team, or session only)

# Claude Code Changelog Index

*This index tracks all Claude Code versions monitored by this repository.*

