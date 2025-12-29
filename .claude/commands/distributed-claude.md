---
name: distributed-claude
description: Send prompts to a remote Claude Code instance running on a VPS via Doppler. Useful for distributed AI workflows, having multiple Claude instances collaborate, or running Claude with different API backends (like Z.ai) from your local Claude.
---

# Distributed Claude

Chat with a remote Claude Code instance running on the Hetzner server.

## Usage

```bash
# On the server:
ssh ebowwa-deptwar "cd ~/seed && ./chat.sh 'your prompt'"

# With custom project/config:
ssh ebowwa-deptwar "cd ~/seed && ./chat.sh 'your prompt' --project myproj --config dev"
```

## Why This Exists

1. **Different Backend**: Run Claude with Z.ai's GLM models while your local Claude uses Anthropic
2. **Collaboration**: Two Claude instances can work together on different aspects of a problem
3. **Persistence**: Remote Claude maintains conversation history independent of your local session
4. **Testing**: Test prompts on different models/backends without switching your local config

## The Chat Script

The `chat.sh` script:
- Loads secrets from Doppler (configurable project/config)
- Maintains conversation history in `/tmp/c.txt`
- Sends full context to remote Claude each time
- Returns response with full context intact

## Architecture

```
Local Claude (Anthropic)
       |
       v
ssh ebowwa-deptwar "./chat.sh 'prompt'"
       |
       v
Remote Claude (Z.ai GLM-4.7)
       |
       v
Response (with full context)
```

## Reset Conversation

```bash
ssh ebowwa-deptwar "rm /tmp/c.txt"
```
