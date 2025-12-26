---
name: track-claude-code
description: Track and document new Claude Code changes from the official GitHub repository
---

# Track Claude Code Changes

Check for new versions and changes in the [anthropics/claude-code](https://github.com/anthropics/claude-code) repository.

## Instructions

1. Fetch the latest CHANGELOG from `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`
2. Check the current tracked version in `docs/claude-code-tracked-versions.md`
3. Extract new changes since the last tracked version
4. Update both the tracking file and the new changes document
5. Commit with message format: `chore: track Claude Code version X.X.X`

## Files to Update

- `docs/claude-code-tracked-versions.md` - Version tracking table
- `docs/claude-code-new-changes.md` - Detailed new changes

## Example Output

```markdown
# Claude Code - New Changes

*Last checked: 2025-12-26 09:00:00 UTC*

## Version 2.0.74
- Added LSP tool for code intelligence
- Added /terminal-setup support for more terminals
- Fixed skill allowed-tools not being applied
...
```

After documenting changes, ask if the user wants to commit them.
