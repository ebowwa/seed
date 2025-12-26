# Claude Code Skills

<Info>
  Claude Code Skills are modular capabilities that extend Claude's functionality through organized folders containing instructions and optional supporting files. Unlike slash commands, skills are automatically discovered and invoked by Claude based on context.
</Info>

## Overview

**Agent Skills** enable Claude to autonomously invoke specialized capabilities based on your request. They are model-invoked (Claude decides when to use them) rather than user-invoked like slash commands.

### Key Characteristics

- **Model-invoked**: Claude autonomously decides when to use skills based on your request and the skill's description
- **Auto-discovery**: Skills are discovered automatically through metadata pre-loaded at startup
- **Multi-file support**: Can include scripts, templates, and reference documentation
- **Team-shareable**: Project skills can be checked into git for team collaboration

## Skills vs Slash Commands

| Aspect | Slash Commands | Agent Skills |
|--------|----------------|--------------|
| **Invocation** | User (`/command`) | Model (automatic) |
| **Complexity** | Simple prompts | Complex, multi-step workflows |
| **Structure** | Single `.md` file | Directory with `SKILL.md` + resources |
| **Discovery** | Explicit invocation | Automatic (context-based) |
| **Files** | One file only | Multiple files, scripts, templates |
| **Scope** | `.claude/commands/` or `~/.claude/commands/` | `.claude/skills/` or `~/.claude/skills/` |

### When to Use Slash Commands
- Quick, frequently used prompts
- Simple prompt snippets
- You want explicit control over when it runs
- Examples: `/review`, `/explain`, `/optimize`

### When to Use Skills
- Comprehensive capabilities with structure
- Complex workflows with multiple steps
- Capabilities requiring scripts or utilities
- Knowledge organized across multiple files
- Team workflows you want to standardize

## Directory Structure

### Personal Skills
```
~/.claude/skills/
├── my-skill/
│   └── SKILL.md
└── another-skill/
    ├── SKILL.md
    ├── reference.md
    └── scripts/
        └── helper.py
```

- **Location**: `~/.claude/skills/`
- **Scope**: Available across all your projects
- **Use for**: Individual workflows, experimental skills, personal productivity tools
- **Not tracked in git**

### Project Skills
```
.claude/skills/
├── team-skill/
│   ├── SKILL.md
│   ├── examples.md
│   └── templates/
│       └── template.json
└── another-team-skill/
    └── SKILL.md
```

- **Location**: `.claude/skills/`
- **Scope**: Shared with your team
- **Use for**: Team workflows, project-specific expertise, shared utilities
- **Checked into git**

## SKILL.md Format

Every skill requires a `SKILL.md` file with YAML frontmatter:

```yaml
---
name: your-skill-name
description: Brief description of what this skill does and when to use it
allowed-tools: Read, Grep, Glob  # Optional: restrict tool access
---
# Your Skill Name

## Instructions
Provide clear, step-by-step guidance for Claude.

## Examples
Show concrete examples of using this skill.
```

### Field Requirements

**`name`** (required):
- Maximum 64 characters
- Must use **lowercase letters, numbers, and hyphens only**
- Cannot contain XML tags
- Cannot contain reserved words: "anthropic", "claude"
- **Recommended**: Use **gerund form** (verb + -ing): `processing-pdfs`, `analyzing-spreadsheets`

**`description`** (required):
- Maximum 1024 characters
- Must be non-empty
- Cannot contain XML tags
- **Critical for discovery** - must include both **what** the skill does and **when** to use it
- **Write in third person**: "Processes Excel files" not "I can help you process Excel files"

**`allowed-tools`** (optional):
- Comma-separated list of tools Claude can use without permission when skill is active
- Example: `Read, Grep, Glob` for read-only skills

### Multi-file Skill Structure

```
my-skill/
├── SKILL.md              # Required: Main instructions
├── reference.md          # Optional: Reference documentation
├── examples.md           # Optional: Usage examples
├── forms.md              # Optional: Form-specific guide
└── scripts/
    ├── helper.py         # Optional: Utility scripts
    └── validate.py       # Optional: Validation scripts
```

## Creating Skills

### Personal Skill

```bash
mkdir -p ~/.claude/skills/my-skill-name
# Create SKILL.md with the format above
```

### Project Skill

```bash
mkdir -p .claude/skills/my-skill-name
# Create SKILL.md
git add .claude/skills/
git commit -m "Add team skill for [purpose]"
```

## Examples

### Simple Skill (Single File)

```
commit-helper/
└── SKILL.md
```

```yaml
---
name: generating-commit-messages
description: Generates clear commit messages from git diffs. Use when writing commit messages or reviewing staged changes.
---
# Generating Commit Messages

## Instructions
1. Run `git diff --staged` to see changes
2. Suggest a commit message with:
   - Summary under 50 characters
   - Detailed description
   - Affected components

## Best Practices
- Use present tense
- Explain what and why, not how
```

### Skill with Tool Permissions

```yaml
---
name: code-reviewer
description: Review code for best practices and potential issues. Use when reviewing code, checking PRs, or analyzing code quality.
allowed-tools: Read, Grep, Glob
---
# Code Reviewer

## Review Checklist
1. Code organization and structure
2. Error handling
3. Performance considerations
4. Security concerns
5. Test coverage
```

### Multi-file Skill

```
pdf-processing/
├── SKILL.md
├── FORMS.md
├── REFERENCE.md
└── scripts/
    ├── fill_form.py
    └── validate.py
```

**SKILL.md:**

```yaml
---
name: pdf-processing
description: Extract text, fill forms, merge PDFs. Use when working with PDF files, forms, or document extraction.
---
# PDF Processing

## Quick Start
Extract text:
```python
import pdfplumber
with pdfplumber.open("doc.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

For form filling, see [FORMS.md](forms.md).
For detailed API reference, see [REFERENCE.md](reference.md).
```

## Testing Skills

After creating a skill, test by asking questions that match your description:

```
Can you help me extract text from this PDF?
```

Claude autonomously decides to use your skill if it matches the request.

## Debugging Skills

If Claude doesn't use your skill:

1. **Make description specific** - Include both what it does and when to use it
2. **Verify file path** - Check `~/.claude/skills/skill-name/SKILL.md` or `.claude/skills/skill-name/SKILL.md`
3. **Check YAML syntax** - Ensure valid frontmatter with `---` delimiters
4. **Run debug mode**: `claude --debug`

## Managing Skills

### Updating a Skill
Edit `SKILL.md` directly. Changes take effect next time you start Claude Code.

### Removing a Skill

```bash
# Personal
rm -rf ~/.claude/skills/my-skill

# Project
rm -rf .claude/skills/my-skill
git commit -m "Remove unused skill"
```

## Best Practices

1. **Keep skills focused** - One skill should address one capability
2. **Write clear descriptions** - Help Claude discover when to use skills with specific triggers
3. **Test with your team** - Ensure skills activate when expected and instructions are clear
4. **Use progressive disclosure** - Keep SKILL.md under 500 lines; split into separate files
5. **Be concise** - Assume Claude is smart; only add context it doesn't already have
6. **Set appropriate degrees of freedom** - Match specificity to task fragility
7. **Provide utility scripts** - More reliable than generated code, saves tokens
8. **Use forward slashes** in file paths (works across all platforms)

## Current Project Status

This project (`/workspaces/seed`) currently has **no skills defined yet**.

You can create:
- `.claude/skills/` for team skills
- `~/.claude/skills/` for personal skills

## Related Resources

- [Agent Skills Documentation](https://code.claude.com/docs/en/skills.md)
- [Skill Authoring Best Practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [Slash Commands Documentation](https://code.claude.com/docs/en/slash-commands.md)
