# MCP Integration for Seed Node-Agent

## Summary

Added MCP (Model Context Protocol) server support to the Seed node-agent, enabling dynamic tool loading from MCP servers configured in `/root/.mcp.json`.

## Changes Made

### 1. New File: `src/lib/mcp-client.ts`

A standalone MCP client implementation supporting:
- **JSON-RPC 2.0 protocol** over stdio transport
- **MCPManager** - Manages multiple MCP servers
- **MCPClient** - Single server client with tool discovery and execution
- **Config loading** - Reads `.mcp.json` format
- **Tool conversion** - Converts MCP tools to `@ebowwa/ai/tools` format

### 2. Modified: `src/services/daemon/daemon-layer-agent.ts`

- Added `mcpConfigPath` configuration option (default: `/root/.mcp.json`)
- Added `mcpManager` and `mcpTools` properties
- Integrated MCP server loading in `start()` method
- Added `loadMCPServers()` private method
- Added `convertMCPTools()` private method
- Updated `stop()` to cleanup MCP servers
- Updated SEED_PROMPT to mention MCP tools

## Configuration

### MCP Config Format (`/root/.mcp.json`)

```json
{
  "mcpServers": {
    "git": {
      "command": "git-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

### Environment Variables

No new environment variables required. MCP config is loaded from the JSON file.

## Deployment

### Prerequisites

1. **git-mcp installed** on the VPS:
   ```bash
   npm install -g git-mcp
   ```

2. **MCP config exists** at `/root/.mcp.json`

### Deploy to VPS

```bash
# Copy the new files to the VPS
scp /Users/ebowwa/Desktop/codespaces/packages/seed/node-agent/src/lib/mcp-client.ts \
    root@78.47.198.15:/root/seed/node-agent/src/lib/

scp /Users/ebowwa/Desktop/codespaces/packages/seed/node-agent/src/services/daemon/daemon-layer-agent.ts \
    root@78.47.198.15:/root/seed/node-agent/src/services/daemon/

# Restart the node-agent service
ssh root@78.47.198.15 "systemctl restart seed-node-agent"
```

### Alternative: Git Deploy

If the node-agent is deployed from a git repository:

```bash
# Commit the changes
git add src/lib/mcp-client.ts
git add src/services/daemon/daemon-layer-agent.ts
git commit -m "feat: add MCP server integration to node-agent"

# Push to the VPS repo
git push origin <branch>

# On the VPS, pull and restart
ssh root@78.47.198.15 "cd /root/seed/node-agent && git pull && systemctl restart seed-node-agent"
```

## Verification

After deployment, check logs for MCP integration:

```bash
ssh root@78.47.198.15 "journalctl -u seed-node-agent -n 50 --no-pager"
```

Look for:
- `[Seed] Loading MCP servers from: /root/.mcp.json`
- `[MCP] Starting server: git`
- `[MCP] Server git initialized`
- `[MCP] Discovered X tools total`

## Testing

Via Telegram, send a message that would use an MCP tool:
- "Show git status" - should use `git_status` from git-mcp
- "Check recent commits" - should use `git_log` from git-mcp

## Troubleshooting

### MCP server not starting

Check if git-mcp is installed:
```bash
which git-mcp
```

Install if missing:
```bash
npm install -g git-mcp
```

### Tools not discovered

Check MCP config format:
```bash
cat /root/.mcp.json
```

### Server connection issues

Check node-agent logs for MCP errors:
```bash
journalctl -u seed-node-agent -f
```

## Architecture

```
DaemonLayerAgentService
  │
  ├── GLMClient (AI)
  │
  ├── ToolExecutor
  │   ├── BUILTIN_TOOLS (file ops, shell, etc.)
  │   └── MCP Tools (from MCP servers)
  │
  └── MCPManager
      └── MCPClient[] (stdio transport)
          └── MCP Server Process (git-mcp, etc.)
```

## Future Enhancements

1. **HTTP transport** for remote MCP servers
2. **Tool caching** to speed up startup
3. **Hot reload** of MCP config changes
4. **Health monitoring** for MCP servers
5. **Rate limiting** for tool calls
