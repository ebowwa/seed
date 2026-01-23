
---

## 2.1.17 - 2026-01-23 18:11:44 UTC


- Fixed crashes on processors without AVX instruction support

## 2.1.16

- Added new task management system, including new capabilities like dependency tracking
- [VSCode] Added native plugin management support
- [VSCode] Added ability for OAuth users to browse and resume remote Claude sessions from the Sessions dialog
- Fixed out-of-memory crashes when resuming sessions with heavy subagent usage
- Fixed an issue where the "context remaining" warning was not hidden after running `/compact`
- Fixed session titles on the resume screen not respecting the user's language setting
- [IDE] Fixed a race condition on Windows where the Claude Code sidebar view container would not appear on start


---

## 2.1.15 - 2026-01-22 18:11:03 UTC


- Added deprecation notification for npm installations - run `claude install` or see https://docs.anthropic.com/en/docs/claude-code/getting-started for more options
- Improved UI rendering performance with React Compiler
- Fixed the "Context left until auto-compact" warning not disappearing after running `/compact`
- Fixed MCP stdio server timeout not killing child process, which could cause UI freezes


---

## 2.1.14 - 2026-01-21 18:19:10 UTC


- Added history-based autocomplete in bash mode (`!`) - type a partial command and press Tab to complete from your bash command history
- Added search to installed plugins list - type to filter by name or description
- Added support for pinning plugins to specific git commit SHAs, allowing marketplace entries to install exact versions
- Fixed a regression where the context window blocking limit was calculated too aggressively, blocking users at ~65% context usage instead of the intended ~98%
- Fixed memory issues that could cause crashes when running parallel subagents
- Fixed memory leak in long-running sessions where stream resources were not cleaned up after shell commands completed
- Fixed `@` symbol incorrectly triggering file autocomplete suggestions in bash mode
- Fixed `@`-mention menu folder click behavior to navigate into directories instead of selecting them
- Fixed `/feedback` command generating invalid GitHub issue URLs when description is very long
- Fixed `/context` command to show the same token count and percentage as the status line in verbose mode
- Fixed an issue where `/config`, `/context`, `/model`, and `/todos` command overlays could close unexpectedly
- Fixed slash command autocomplete selecting wrong command when typing similar commands (e.g., `/context` vs `/compact`)
- Fixed inconsistent back navigation in plugin marketplace when only one marketplace is configured
- Fixed iTerm2 progress bar not clearing properly on exit, preventing lingering indicators and bell sounds
- Improved backspace to delete pasted text as a single token instead of one character at a time
- [VSCode] Added `/usage` command to display current plan usage


---

## 2.1.12 - 2026-01-17 18:09:43 UTC


- Fixed message rendering bug

## 2.1.11

- Fixed excessive MCP connection requests for HTTP/SSE transports

## 2.1.10

- Added new `Setup` hook event that can be triggered via `--init`, `--init-only`, or `--maintenance` CLI flags for repository setup and maintenance operations
- Added keyboard shortcut 'c' to copy OAuth URL when browser doesn't open automatically during login
- Fixed a crash when running bash commands containing heredocs with JavaScript template literals like `${index + 1}`
- Improved startup to capture keystrokes typed before the REPL is fully ready
- Improved file suggestions to show as removable attachments instead of inserting text when accepted
- [VSCode] Added install count display to plugin listings
- [VSCode] Added trust warning when installing plugins


---

## 2.1.9 - 2026-01-16 18:11:45 UTC


- Added `auto:N` syntax for configuring the MCP tool search auto-enable threshold, where N is the context window percentage (0-100)
- Added `plansDirectory` setting to customize where plan files are stored
- Added external editor support (Ctrl+G) in AskUserQuestion "Other" input field
- Added session URL attribution to commits and PRs created from web sessions
- Added support for `PreToolUse` hooks to return `additionalContext` to the model
- Added `${CLAUDE_SESSION_ID}` string substitution for skills to access the current session ID
- Fixed long sessions with parallel tool calls failing with an API error about orphan tool_result blocks
- Fixed MCP server reconnection hanging when cached connection promise never resolves
- Fixed Ctrl+Z suspend not working in terminals using Kitty keyboard protocol (Ghostty, iTerm2, kitty, WezTerm)


---

## 2.1.7 - 2026-01-14 18:11:33 UTC


- Added `showTurnDuration` setting to hide turn duration messages (e.g., "Cooked for 1m 6s")
- Added ability to provide feedback when accepting permission prompts
- Added inline display of agent's final response in task notifications, making it easier to see results without reading the full transcript file
- Fixed security vulnerability where wildcard permission rules could match compound commands containing shell operators
- Fixed false "file modified" errors on Windows when cloud sync tools, antivirus scanners, or Git touch file timestamps without changing content
- Fixed orphaned tool_result errors when sibling tools fail during streaming execution
- Fixed context window blocking limit being calculated using the full context window instead of the effective context window (which reserves space for max output tokens)
- Fixed spinner briefly flashing when running local slash commands like `/model` or `/theme`
- Fixed terminal title animation jitter by using fixed-width braille characters
- Fixed plugins with git submodules not being fully initialized when installed
- Fixed bash commands failing on Windows when temp directory paths contained characters like `t` or `n` that were misinterpreted as escape sequences
- Improved typing responsiveness by reducing memory allocation overhead in terminal rendering
- Enabled MCP tool search auto mode by default for all users. When MCP tool descriptions exceed 10% of the context window, they are automatically deferred and discovered via the MCPSearch tool instead of being loaded upfront. This reduces context usage for users with many MCP tools configured. Users can disable this by adding `MCPSearch` to `disallowedTools` in their settings.
- Changed OAuth and API Console URLs from console.anthropic.com to platform.claude.com
- [VSCode] Fixed `claudeProcessWrapper` setting passing the wrapper path instead of the Claude binary path


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

