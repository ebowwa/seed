# Node Setup & Troubleshooting Guide

## System Overview

This node runs three core services:

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| `node-agent.service` | 8911 | Ralph loop orchestration API | ✅ Running |
| `telegram-bot.service` | - | Telegram interface to Claude Code | ✅ Running |

---

## Initial Setup Checklist

### 1. System Requirements
- OS: Ubuntu/Debian Linux
- CPU: 2+ cores
- RAM: 4GB+
- Disk: 50GB+
- Network: Public IP with outbound access

### 2. Repository Setup

```bash
# Create repos directory
mkdir -p /root/repos
cd /root/repos

# Clone main repository
git clone https://github.com/ebowwa/ralph.git main-repo
cd main-repo
git checkout dev  # Always work on dev branch

# Verify git config
git config --global user.name "seed-node-prod"
git config --global user.email "seed@node.tailnet"
```

### 3. Doppler Setup (Secrets Management)

```bash
# Install Doppler CLI
curl -fsSL https://cli.doppler.com/install.sh | sh

# Authenticate
doppler login

# Verify access
doppler setup -p seed -c prd
```

### 5. Node Agent Setup

```bash
# Clone seed repository
cd /root
git clone https://github.com/ebowwa/seed.git
cd seed/node-agent

# Install dependencies
bun install

# Create data directory
mkdir -p /root/.local/share/ralph-node-agent

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Set up systemd service
cp systemd/node-agent.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable node-agent.service
systemctl start node-agent.service
```

### 6. Telegram Bot Setup (Optional)

```bash
# Install globally
bun pm install -g @ebowwa/channel-telegram

# Create systemd service
cat > /etc/systemd/system/telegram-bot.service <<'EOF'
[Unit]
Description=GLM Daemon Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
Environment="PROMPTS_FILE=/root/prompts.json"
ExecStart=/usr/bin/doppler run -p seed -c prd -- /root/.bun/bin/bun /root/.bun/install/global/node_modules/@ebowwa/channel-telegram/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable telegram-bot.service
systemctl start telegram-bot.service
```

---

## Configuration

### Node Agent `.env` File

```bash
# Server Configuration
NODE_AGENT_PORT=8911
NODE_AGENT_HOST=0.0.0.0

# Repository Configuration
REPOS_BASE_PATH=/root/repos
DEFAULT_REPOSITORY=main-repo

# Doppler Configuration
DOPPLER_PROJECT=seed
DOPPLER_CONFIG=prd

# GitHub Configuration (for PR creation)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Max concurrent Ralph loops
MAX_CONCURRENT_LOOPS=2

# PM Daemon Configuration (ONLY ONE NODE should have this enabled!)
PM_DAEMON_ENABLED=false

# PM Monitor (only if PM_DAEMON_ENABLED=true)
PM_MONITOR_INTERVAL_MS=30000
PM_STALL_THRESHOLD_MINUTES=10
```

### Key Configuration Rules

| Setting | Rule | Why |
|---------|------|-----|
| `PM_DAEMON_ENABLED` | Only ONE node should be `true` | Prevents duplicate orchestration |
| `MAX_CONCURRENT_LOOPS` | Scale based on CPU/RAM | 2 per CPU core is safe |
| `GITHUB_TOKEN` | Required for PR creation | Ralph pushes work via PRs |
| `REPOS_BASE_PATH` | Must exist and be writeable | Where worktrees are created |

---

## Troubleshooting

### Node Agent Service Won't Start

**Symptom**: `systemctl status node-agent.service` shows `FAILED`

#### Check 1: Port in Use
```bash
lsof -i :8911
# If port is taken, kill the process or change PORT in .env
kill -9 <pid>
```

#### Check 2: Missing .env File
```bash
test -f /root/seed/node-agent/.env || echo "MISSING .env FILE"
```

#### Check 3: Missing Data Directory
```bash
mkdir -p /root/.local/share/ralph-node-agent
```

#### Check 4: PM Daemon Misconfiguration
```bash
# If you see: "PM_DAEMON_ENABLED is true, but TELEGRAM_BOT_TOKEN is not set"
# Either disable PM_DAEMON in .env, or set up Telegram bot in Doppler
```

#### Check Logs
```bash
journalctl -u node-agent.service --since "5 minutes ago" -n 100
```

---

### PM Daemon Telegram Errors

**Symptom**: Node agent crashes with "TELEGRAM_BOT_TOKEN is not set"

**Solution**: Set Telegram secrets in Doppler:

```bash
doppler secrets set TELEGRAM_BOT_TOKEN <bot-token>
doppler secrets set TELEGRAM_CHAT_ID <your-chat-id>
```

**OR** disable PM Daemon (recommended for worker nodes):

```bash
# In /root/seed/node-agent/.env:
PM_DAEMON_ENABLED=false
```

---

### Git/Worktree Issues

**Symptom**: Worktrees can't be created

#### Check Git Worktree Support
```bash
cd /root/repos/main-repo
git worktree list
```

#### Clean Up Stale Worktrees
```bash
cd /root/repos/main-repo
git worktree prune
```

#### Check .git Directory Permissions
```bash
ls -la /root/repos/main-repo/.git
# Should be owned by root and have proper permissions
```

---

### Memory/Resource Issues

**Symptom**: High memory usage, slow performance

#### Check Current Usage
```bash
free -h
df -h
top -bn1 | head -20
```

#### Check Node Agent API
```bash
curl -s http://localhost:8911/api/status | jq '.capacity'
```

#### Adjust MAX_CONCURRENT_LOOPS
```bash
# In /root/seed/node-agent/.env:
MAX_CONCURRENT_LOOPS=1  # Reduce if memory is tight
systemctl restart node-agent.service
```

---

## API Quick Reference

### Node Agent API (Port 8911)

```bash
# Check node status
curl http://localhost:8911/api/status | jq

# List worktrees
curl http://localhost:8911/api/worktrees | jq

# Create worktree
curl -X POST http://localhost:8911/api/worktrees \
  -H "Content-Type: application/json" \
  -d '{"worktree_id":"test-123","branch":"dev","repository":"main-repo"}'

# Create Ralph loop
curl -X POST http://localhost:8911/api/ralph-loops \
  -H "Content-Type: application/json" \
  -d '{"worktree_id":"test-123","prompt":"Test prompt"}'

# List Ralph loops
curl http://localhost:8911/api/ralph-loops | jq

# Get Ralph loop logs
curl http://localhost:8911/api/ralph-loops/<id>/logs | jq
```

---

## Health Monitoring

### Manual Health Check

```bash
#!/bin/bash
# health-check.sh

echo "=== System Health ==="
echo "Uptime: $(uptime -p)"
echo "CPU Load: $(cat /proc/loadavg | cut -d' ' -f1-3)"
echo "Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"

echo ""
echo "=== Services ==="
systemctl is-active node-agent.service && echo "✓ Node Agent" || echo "✗ Node Agent"
systemctl is-active telegram-bot.service && echo "✓ Telegram Bot" || echo "✗ Telegram Bot"
systemctl is-active tailscaled.service && echo "✓ Tailscale" || echo "✗ Tailscale"

echo ""
echo "=== Node Agent Status ==="
curl -s http://localhost:8911/api/status | jq '.capacity'

echo ""
echo "=== Active Ralph Loops ==="
curl -s http://localhost:8911/api/ralph-loops | jq 'length'
```

### Automated Monitoring (Cron)

```bash
# Add to crontab for every 10 minutes
*/10 * * * * /root/seed/health-check.sh >> /var/log/node-health.log 2>&1
```

---

## Security Checklist

- [ ] Firewall configured (only necessary ports open)
- [ ] SSH key-based authentication only (no password auth)
- [ ] Fail2Ban enabled and running
- [ ] Tailscale authenticated
- [ ] Doppler secrets properly scoped
- [ ] GitHub token has minimum required permissions
- [ ] Logs are rotated
- [ ] Regular updates applied (`apt update && apt upgrade`)

---

## Common Commands Reference

```bash
# Service Management
systemctl start node-agent.service
systemctl stop node-agent.service
systemctl restart node-agent.service
systemctl status node-agent.service

# View Logs
journalctl -u node-agent.service -f           # Follow logs
journalctl -u node-agent.service --since "1h"  # Last hour
journalctl -u node-agent.service -p err       # Errors only

# Git Operations
cd /root/repos/main-repo
git status
git pull origin dev
git branch -a

# Worktree Management
git worktree list
git worktree prune
git worktree add /path/to/worktree dev

# System Resources
free -h              # Memory
df -h                # Disk
top                  # Processes
htop                 # Interactive process viewer

# Network
tailscale status     # VPN status
ip addr show         # Network interfaces
ss -tlnp             # Listening ports
```

---

## Getting Help

### Debug Information to Collect

```bash
# Run this and save output when troubleshooting
echo "=== System Info ===" > debug-info.txt
uname -a >> debug-info.txt
uptime >> debug-info.txt

echo "" >> debug-info.txt
echo "=== Services ===" >> debug-info.txt
systemctl status node-agent.service >> debug-info.txt
systemctl status telegram-bot.service >> debug-info.txt
systemctl status tailscaled.service >> debug-info.txt

echo "" >> debug-info.txt
echo "=== Node Agent Status ===" >> debug-info.txt
curl -s http://localhost:8911/api/status >> debug-info.txt

echo "" >> debug-info.txt
echo "=== Recent Logs ===" >> debug-info.txt
journalctl -u node-agent.service --since "1 hour ago" >> debug-info.txt

echo "" >> debug-info.txt
echo "=== Git Status ===" >> debug-info.txt
cd /root/repos/main-repo && git status >> debug-info.txt
```

---

## Next Steps After Setup

1. ✅ Verify all services are running
2. ✅ Test API endpoints
3. ✅ Verify Tailscale connectivity
4. ✅ Run a test Ralph loop
5. ✅ Set up monitoring/health checks
6. ✅ Document node-specific configs
7. ✅ Add to orchestration (if worker node)

---

Last Updated: 2026-02-13
Maintained by: seed (seed-node-prod.tail9f1fc.ts.net)
