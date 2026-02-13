# Git Token → Doppler Migration

## ✅ Completed

### 1. Identified Git Token in Doppler
The GitHub token was already stored securely in Doppler:

```
Project: seed
Config: prd
Secret: GITHUB_TOKEN
Value: gho_**REDACTED**
```

### 2. Removed Hardcoded Token from Repositories
Found and removed the token from `/root/seed/.git/config`:

**Before:**
```ini
[remote "origin"]
	url = https://ebowwa:gho_**REDACTED**@github.com/ebowwa/seed.git
```

**After:**
```ini
[remote "origin"]
	url = https://github.com/ebowwa/seed.git
```

### 3. Created Git Credential Helper
Created `/root/.git-credentials-doppler` - a script that:
- Hooks into git's credential system
- Fetches the token from Doppler when needed
- No tokens stored in plain text anywhere

### 4. Configured Git Globally
```bash
# Set the credential helper
git config --global credential.helper /root/.git-credentials-doppler

# Set default username
git config --global credential.https://github.com.username ebowwa
```

### 5. Verified Functionality
- ✅ Cloned test repository successfully
- ✅ Git fetch works without hardcoded tokens
- ✅ Token is retrieved from Doppler on-demand

## How It Works

### Git Credential Protocol
When git needs credentials:
1. Git calls the credential helper (`/root/.git-credentials-doppler`)
2. Script reads stdin (protocol, host, etc.)
3. If it's `github.com`, it calls Doppler API
4. Returns credentials to git via stdout
5. Git uses them for authentication

### Security Benefits
| Before | After |
|--------|-------|
| Token in `.git/config` (world-readable if permissions fail) | Token encrypted in Doppler |
| Token visible in logs/history | Token retrieved on-demand |
| Manual rotation needed | Rotate once in Doppler, all nodes benefit |
| Hardcoded per-repo | Centralized management |

## Current State

### Global Git Configuration
```bash
~/.gitconfig:
[credential]
    helper = /root/.git-credentials-doppler
[credential "https://github.com"]
    username = ebowwa
```

### Repositories
All repositories now use clean URLs:
- `/root/seed` → `https://github.com/ebowwa/seed.git`
- `/root/repos/main-repo` → `https://github.com/ebowwa/ralph.git`

### GitHub CLI (gh)
Authenticated via token in Doppler (already secure):
```bash
gh auth status
✓ Logged in to github.com account ebowwa (GITHUB_TOKEN)
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

## Multi-Node Setup

For new nodes, just run:

```bash
# Install Doppler and login
curl -fsSL https://cli.doppler.com/install.sh | sh
doppler login

# Configure git credential helper
git config --global credential.helper /root/.git-credentials-doppler
git config --global credential.https://github.com.username ebowwa

# Clone repositories - tokens fetched automatically!
git clone https://github.com/ebowwa/seed.git
git clone https://github.com/ebowwa/ralph.git
```

The credential helper script should be part of the node bootstrap process.

## Rotation

To rotate the GitHub token:

1. **Update in Doppler:**
   ```bash
   doppler secrets set GITHUB_TOKEN "new_token_here" --project seed --config prd
   ```

2. **Done!** All nodes automatically use the new token on next git operation.

No need to touch `.git/config` files on any node.

## Testing

Verify the setup works:

```bash
# Test credential helper directly
printf "protocol=https\nhost=github.com\n\n" | /root/.git-credentials-doppler

# Should output:
# username=ebowwa
# password=gho_**REDACTED**

# Test git clone
cd /tmp && git clone https://github.com/ebowwa/seed.git test-clone
rm -rf test-clone
```

## Related Files

- `/root/.git-credentials-doppler` - Credential helper script
- `~/.gitconfig` - Global git configuration
- `/root/seed/DOPLER-MIGRATION-SUMMARY.md` - This document

## Next Steps

1. ✅ Remove hardcoded tokens from all repositories
2. ✅ Create git credential helper using Doppler
3. ⬜ Add credential helper setup to bootstrap script
4. ⬜ Test on fresh node

---

Completed: 2025-02-13
Status: ✅ Operational
