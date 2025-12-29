# JSON-RPC 2.0 Protocol Specification
# Session Manager for Multi-Session Claude Orchestration

## Overview

This document specifies the JSON-RPC 2.0 protocol for the session manager that enables
desktop Claude Code to orchestrate multiple specialized Claude workers on a VPS node.

## Transport

- **Protocol**: JSON-RPC 2.0 over stdin/stdout
- **Encoding**: UTF-8
- **Line-based**: Each request is a single JSON line, response is a single JSON line
- **Connection**: Typically over SSH: `ssh server "cd ~/seed && ./session-manager.sh"`

## Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": { /* method-specific parameters */ },
  "id": 1
}
```

## Response Format

### Success Response

```json
{
  "jsonrpc": "2.0",
  "result": { /* method-specific result */ },
  "id": 1
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Error description",
    "data": { /* optional additional error details */ }
  },
  "id": 1
}
```

## Standard Error Codes

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON was received |
| -32600 | Invalid Request | The JSON sent is not a valid Request object |
| -32601 | Method not found | The method does not exist |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Internal JSON-RPC error |

## Custom Error Codes

| Code | Message | Description |
|------|---------|-------------|
| -32000 | Session not found | The specified session does not exist |
| -32001 | Session exists | A session with this name already exists |
| -32002 | Lock timeout | Failed to acquire session lock |
| -32003 | Invalid session name | Session name contains invalid characters |
| -32004 | Execution failed | Claude execution failed |

## Methods

### create_session

Create a new agent session with isolated context.

**Parameters:**

```json
{
  "name": "agent-code-review",
  "role": "Code Review Agent",
  "system_prompt": "You are...",
  "config": {
    "project": "seed",
    "config": "prd"
  },
  "metadata": {
    "tags": ["security", "python"],
    "workspace": "/root/seed"
  }
}
```

### list_sessions

List all sessions with optional filtering.

### send_message

Send a message to a session and get Claude's response.

### delete_session, reset_session, broadcast_message, get_system_status

See full protocol documentation for details.

## Example Usage

```bash
# Create a session
echo '{"jsonrpc":"2.0","method":"create_session","params":{"name":"reviewer","role":"Code Reviewer"},"id":1}' | \
  ssh server "cd ~/seed && ./session-manager.sh"

# Send a message
echo '{"jsonrpc":"2.0","method":"send_message","params":{"session":"reviewer","message":"Review setup.sh"},"id":2}' | \
  ssh server "cd ~/seed && ./session-manager.sh"
```
