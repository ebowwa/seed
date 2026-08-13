# Mac mini Headless Server — Setup Archive

Reproducible record of everything configured on this box on **2026-06-27**.
Treat this repo as the source of truth for rebuilding the machine (or cloning a second one).

## Machine
- **Model:** Mac mini (Macmini9,1), Apple M1, 8-core (4P+4E), 16 GB
- **OS:** macOS 26.5.1 (Tahoe), Build 25F80
- **Role:** headless always-on server + self-hosted GitHub Actions runner
- **Display:** AR glasses + USB keyboard/mouse, plugged in on demand

## Goals
1. Never sleep / never shut down on its own; recover unattended after a power cut.
2. Persistent dev environment (Homebrew, PATH, Claude Code, secrets).
3. Self-hosted GitHub Actions runner that survives reboots with no login.

---

## 1. Power & sleep (always-on)

Current `pmset` settings on AC (verified good):

| Setting | Value | Meaning |
|---|---|---|
| `sleep` | `0` | never idle-sleep |
| `displaysleep` | `0` | display never sleeps (moot headless) |
| `autorestart` | `1` | reboots after a power cut |
| `womp` | `1` | wake-on-LAN |
| `standby` | `0` | no deep hibernation |
| `disablesleep` | `0` ⚠️ | **recommended `1`, not yet applied** |

Apply / harden with [`scripts/power-config.sh`](scripts/power-config.sh):

```bash
sudo pmset -a sleep 0 displaysleep 0 autorestart 1 womp 1 standby 0
sudo pmset -a disablesleep 1   # disables ALL sleep incl. maintenance/DarkWake naps
pmset -g
```

**FileVault is OFF** (deliberate) so the machine boots fully unattended after a restart — no pre-boot password to stall it. `auto-login` is also OFF; we chose a system LaunchDaemon (§6) for the runner instead, so no login is needed for CI.

---

## 2. Shell & PATH

`~/.zprofile` (login shells) and `~/.zshrc` (interactive shells) — see [`dotfiles/`](dotfiles/).
Key point: `~/.zshrc` ensures Homebrew + `~/.bun/bin` + `~/.local/bin` are on PATH in **every**
interactive shell (new tabs, after reboot, non-login shells in VS Code/tmux):

```zsh
# ~/.zshrc
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"
```

---

## 3. Dev tools (Homebrew)

See [`scripts/install-dev-tools.sh`](scripts/install-dev-tools.sh). Installed:

| Tool | Source | Purpose |
|---|---|---|
| Homebrew | install.sh → `/opt/homebrew` | package manager |
| uv | `brew install uv` | fast Python package mgr |
| bun | `brew install oven-sh/bun/bun` | JS runtime + `~/.bun/bin` globals |
| doppler | `brew install dopplerhq/cli/doppler` | secrets manager |
| tailscale | `brew install --cask tailscale-app` | mesh VPN for remote access |
| xcodes | `brew install xcodes` | Xcode version manager |
| Xcode CLT | auto, via Homebrew | compilers/headers (1.9 GB) |

---

## 4. Claude Code

Single **native** install at `~/.local/bin/claude` → `~/.local/share/claude/versions/<ver>`
(self-updating, version-managed). A redundant bun-global copy was removed.

API credentials are injected at launch via Doppler:

```bash
doppler run --project seed --config prd claude
```

---

## 5. Disk usage (~29 GB used of 245 GB)

- **~12.6 GB** = macOS itself (read-only System volume; fixed, not "your usage")
- **~16 Gi** = Data volume: ~half is macOS-managed data/caches, ~3.8 GB is your additions
  (Xcode CLT 1.9G, Brave ~0.9G, Homebrew 344M, bun 229M, claude 214M…)
- **0** swap/sleepimage (Apple Silicon).

Nothing bloated. Reclaimable: `brew cleanup` (~105 MB) and optionally the Xcode CLT (1.9 GB)
if you never compile native code.

---

## 6. GitHub Actions self-hosted runner

Runner **v2.335.1**, registered to repo **`ebowwa/secondsee`**, name `mac-mini`, labels `self-hosted, macOS, ARM64, ios`.
Installed at `~/actions-runner/`.

**Stage + register** (token is single-use, ~1 hr, from repo → Settings → Actions → Runners → New self-hosted runner):

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -fsSL -o runner.tar.gz https://github.com/actions/runner/releases/download/v2.335.1/actions-runner-osx-arm64-2.335.1.tar.gz
tar xzf runner.tar.gz && rm runner.tar.gz
./config.sh --url https://github.com/ebowwa/secondsee --token <TOKEN> \
  --unattended --labels "ios" --name "mac-mini"
```

**Convert to a boot-time system daemon** (starts at boot, runs as your user, no login):
[`scripts/convert-runner-daemon.sh`](scripts/convert-runner-daemon.sh). The generated plist is
archived at [`reference/runner-daemon.plist`](reference/runner-daemon.plist).

```bash
sudo bash scripts/convert-runner-daemon.sh
# verify:  sudo launchctl list | grep actions.runner
```

> ⚠️ **Security:** only attach self-hosted runners to *private* repos; never to public repos or
> PR-from-fork workflows — the runner executes arbitrary code.

**Managing the runner service:**
```bash
sudo launchctl bootout system/actions.runner.ebowwa-secondsee.mac-mini   # stop
sudo launchctl bootstrap system /Library/LaunchDaemons/actions.runner.ebowwa-secondsee.mac-mini.plist  # start
```

---

## 7. Xcode (pending)

Needed for iOS/macOS builds. Not yet installed (waiting on Apple ID). Install + post-setup:

```bash
xcodes install 26.6          # prompts for Apple ID + 2FA (cached in keychain after)
sudo xcodebuild -runFirstLaunch
sudo xcodebuild -license accept
sudo xcode-select -s /Applications/Xcode.app
xcodebuild -downloadPlatform iOS   # optional: simulator runtime (~7 GB)
```

> **Future — iOS code signing:** the runner runs in a boot-time session, so the login keychain may
> be locked to it. Use **fastlane match** (certs from an encrypted git repo, unlocked by password)
> rather than relying on the keychain.

---

## 8. Archive contents

```
mac-mini-setup/
├── README.md                       # this file
├── dotfiles/
│   ├── zshrc                       # ~/.zshrc  (PATH for brew + bun/local bins)
│   └── zprofile                    # ~/.zprofile (brew shellenv)
├── scripts/
│   ├── power-config.sh             # pmset always-on policy (sudo)
│   ├── install-dev-tools.sh        # Homebrew + CLI/cask installs
│   └── convert-runner-daemon.sh    # move runner from user agent → system daemon (sudo)
└── reference/
    └── runner-daemon.plist         # the live LaunchDaemon plist (GitHub-generated, archived)
```

`dotfiles/zshrc` and `dotfiles/zprofile` are the **actual** files as they live on disk.
The `scripts/` were reconstructed from the commands run during setup, parameterized with no secrets.
