# HelloNodeSetups

Automated setup scripts and configuration for development machines and CI nodes.

## Nodes

| Directory | Machine | Description |
|---|---|---|
| [`seed/`](seed/) | Main dev server (x86_64 Linux) | Claude Code, GitHub CLI, Tailscale, Doppler — spin up dev-ready machines in seconds |
| [`mac-mini-setup/`](mac-mini-setup/) | Mac mini M1 (headless server) | Power config, dotfiles, Homebrew dev tools, self-hosted GitHub Actions runner daemon |

## Provenance

This repository consolidates previously standalone repos:

- `ebowwa/seed` → `seed/`
- `ebowwa/mac-mini-setup` → `mac-mini-setup/`
