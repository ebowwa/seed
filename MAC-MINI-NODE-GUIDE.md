# Mac mini — Always-On Node Guide

Turn a macOS box (e.g. a headless Mac mini) into an always-on dev/CI node for your fleet: it never sleeps, recovers unattended after a power cut, and runs a self-hosted GitHub Actions runner as a boot-time service.

## Quick start

```bash
# 1. Always-on power policy + runner (provide URL + a fresh token)
RUNNER_URL=https://github.com/<owner>/<repo> \
RUNNER_TOKEN=<token-from-GitHub> \
  ./scripts/setup-mac-mini-node.sh

# 2. (optional) Xcode for iOS/macOS builds -- uncomment setup_xcode in the
#    script, or run directly:
brew install xcodes && xcodes install 26.6
sudo xcodebuild -runFirstLaunch && sudo xcodebuild -license accept
sudo xcode-select -s /Applications/Xcode.app
```

## What it configures

| Area | Setting | Why |
|---|---|---|
| Power | `sleep 0`, `displaysleep 0`, `autorestart 1`, `womp 1`, `standby 0`, `disablesleep 1` | never sleeps; reboots after a power cut; wake-on-LAN |
| Runner | `~/actions-runner` → system LaunchDaemon | starts at boot, runs as your user, no login |
| Xcode | `xcodes install` | iOS/macOS builds |

## Runner as a boot-time daemon

`setup-mac-mini-node.sh` registers the runner (`config.sh`), installs it as a user LaunchAgent (`svc.sh install`), then `convert-runner-to-daemon.sh` moves that plist into `/Library/LaunchDaemons/` (owned `root:wheel`) and loads it into the system domain. Result: the runner survives any reboot/power-cut with no one logged in.

Get a fresh token (single-use, ~1h) at `<repo> → Settings → Actions → Runners → New self-hosted runner → macOS → ARM64`.

Manage it:

```bash
sudo launchctl bootout  system/actions.runner.<owner>-<repo>.<name>                 # stop
sudo launchctl bootstrap system /Library/LaunchDaemons/actions.runner.<...>.plist   # start
```

## Security notes

- **Only attach self-hosted runners to private repos.** The runner executes arbitrary workflow code — never expose it via public repos or PR-from-fork workflows.
- `disablesleep 1` keeps the machine fully awake at the cost of a few extra watts.
- FileVault / auto-login intentionally left OFF: the runner runs at boot as a system daemon, so no login is required for CI.

## See also

- `NODE-SETUP-GUIDE.md` — node-agent fleet setup
- `scripts/convert-runner-to-daemon.sh` — the daemon-conversion helper
