# Autonomous Ralph - Quick Start

## What It Does

Launches an autonomous AI agent that will work for 12 hours on:
1. **Self-improvement** - Reads and improves its own codebase
2. **Infrastructure** - Enhances Hetzner VPS management
3. **Learning** - Studies gastown and clawdbot for patterns to adopt
4. **Documentation** - Improves README and docs
5. **Testing** - Adds and fixes tests

## How to Launch

### Option 1: Run Locally (Before You Leave)

```bash
cd /Users/ebowwa/Desktop/codespaces/seed
./autonomous-ralph.sh
```

### Option 2: Run on Hetzner Node

```bash
# SSH into your node
ssh root@your-node-ip

# Clone/update seed
cd /root/seed
git pull

# Launch autonomous Ralph
./autonomous-ralph.sh
```

### Option 3: Run via Node Agent API

```bash
# Start Ralph loop on remote node
curl -X POST http://your-node:8911/api/ralph-loops \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "autonomous",
    "prompt": "autonomous-12h-shift",
    "maxIterations": 200,
    "workDir": "/root/seed"
  }'
```

## What It Has Access To

| Path | Purpose |
|------|---------|
| `/workspace` | Main codespaces directory |
| `/ralph` | Ralph's own codebase (self-improvement) |
| `/codespaces` | Hetzner infrastructure UI |
| `/seed` | Bootstrap and node agent |
| `/resources/gastown` | Reference: swarm orchestration |
| `/resources/clawdbot` | Reference: WebSocket gateway |
| `/resources/notes.md` | Our conversation context |

## How to Monitor

```bash
# Check if running
cat ~/.ralph/autonomous-loop.txt

# Follow logs in real-time
tail -f ~/.ralph/logs/autonomous.log

# Check git activity
cd ~/codespaces
git log --oneline -10

# See what files changed
git status
```

## How to Stop

```bash
# Graceful stop (after current iteration)
rm ~/.ralph/autonomous-loop.txt

# Or Ctrl+C if running in terminal
```

## What to Expect

- **~200 iterations** over 12 hours
- **~3-4 minutes** per iteration
- **Frequent git commits** with descriptive messages
- **High-impact improvements** only
- **Production-quality code**

## Completion Condition

The agent will stop when it outputs:
```
<promise>AUTONOMOUS_SHIFT_COMPLETE</promise>
```

Or after 200 iterations (~12 hours).

## Checking Results

When you return:

```bash
# View completion log
cat ~/.ralph/history/autonomous-*.log

# See what was done
cd ~/codespaces
git log --since="12 hours ago" --oneline

# Check each project
cd ralph && git log --since="12 hours ago"
cd ../com.hetzner.codespaces && git log --since="12 hours ago"
cd ../seed && git log --since="12 hours ago"
```

## Safety

- **Read-only exploration** before making changes
- **Git branches** for experimental work
- **Frequent commits** for easy rollback
- **No destructive operations** without verification

## Tips

1. **Run locally first** to verify it works
2. **Check git status** before leaving to ensure clean state
3. **Monitor from phone** via SSH if needed
4. **Trust but verify** - review commits when you return
