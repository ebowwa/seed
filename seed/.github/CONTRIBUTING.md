# Contributing to seed

Thank you for your interest in contributing to the seed repository! This document provides guidelines and workflows for contributing.

## Overview

seed is an automation toolkit for setting up AI coding workflows with Claude Code and Z.ai's GLM models. We welcome contributions that improve the project.

## Branch Strategy

We use a simple branch strategy:

```
main     ─────► Production-ready code
  │
  └── dev  ─────► Integration branch for all contributions
            │
            └── feature/*  ──► Feature branches
            └── fix/*       ──► Bug fix branches
```

- **main**: Production-ready, stable code. All changes here are deployed.
- **dev**: Integration branch where all contributions land. Always syncs from main.
- **feature/***: Feature branches forked from dev
- **fix/***: Bug fix branches forked from dev

## Contributor Workflow

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/seed.git
cd seed
```

### 2. Set Up Remotes

```bash
# Add the upstream repository
git remote add upstream https://github.com/ebowwa/seed.git

# Verify remotes
git remote -v
```

### 3. Sync with dev

The `dev` branch is your starting point for all contributions:

```bash
# Fetch latest from upstream
git fetch upstream

# Create or update your local dev branch
git checkout -b dev upstream/dev
# If dev already exists locally:
git checkout dev && git reset --hard upstream/dev

# Push dev to your fork (for backup)
git push origin dev -u
```

### 4. Create Your Branch

Create a feature or fix branch from `dev`:

```bash
# For a new feature
git checkout -b feature/your-feature-name

# For a bug fix
git checkout -b fix/your-bug-fix
```

### 5. Make Your Changes

- Write clear, descriptive commit messages following conventional commit format:
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `docs:` - Documentation changes
  - `chore:` - Maintenance tasks
  - `refactor:` - Code refactoring
  - `test:` - Test additions/changes

```bash
git add .
git commit -m "feat: add XYZ feature"
```

### 6. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 7. Create Pull Request

Create a pull request on GitHub:
- **Base**: `dev` (NOT main)
- **Compare**: Your feature branch
- Title: Use conventional commit format
- Body: Describe your changes with details

## Development Guidelines

### Code Style

- **Shell scripts**: Use 2 spaces for indentation, follow existing patterns
- **YAML**: 2 spaces for indentation
- **Documentation**: Clear, concise, with examples

### Testing

Before submitting a PR:

```bash
# Run the integration test
./tests/test-integration.sh

# Test setup script in dry-run mode
./setup.sh --dry-run
```

### Documentation

- Update relevant documentation for any changes
- Add comments for complex logic in scripts
- Update README.md for user-facing changes

### Security

- Never commit secrets or API keys
- Use environment variables for sensitive data
- Follow the Doppler integration pattern for secrets management

## Maintainer Workflow

### Syncing dev from main

The `dev` branch should periodically sync from `main`:

```bash
git checkout main
git pull upstream main
git checkout dev
git merge main -m "chore: sync dev from main"
git push upstream dev
```

### Merging dev to main

When features on `dev` are ready for production:

```bash
git checkout main
git merge dev -m "chore: merge dev to main for release X.Y.Z"
git push upstream main
```

### After Merge

1. Update version numbers if needed
2. Create a GitHub release
3. Delete merged feature branches

## Project-Specific Notes

### setup.sh

The main setup script is the heart of this project. When modifying:
- Test across multiple environments (VPS, Codespaces, local)
- Verify environment detection logic
- Ensure error handling works correctly
- Update inline comments for complex changes

### MCP Server Integrations

When adding new MCP server integrations:
- Add configuration template to `.claude/`
- Document the integration in `docs/`
- Add to `situations.yaml` if environment-specific
- Test with actual MCP server

### Skills

When adding new Claude Code Skills:
- Create directory in `skills/`
- Include `skill.md` with proper frontmatter
- Document usage in `docs/Claude_Code_Skills.md`
- Test with Claude Code

## Getting Help

- **Documentation**: Check `docs/` for detailed guides
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to seed!
