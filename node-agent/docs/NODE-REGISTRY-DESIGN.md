# Node Registry - Multi-Node Orchestration

**Status**: Deferred until multi-node architecture is implemented
**Created**: 2026-01-28
**Purpose**: Design document for recreating node-registry.ts when needed

---

## Why This Was Deferred

The current architecture runs each node as a self-contained instance:
- Each node runs its own PM daemon locally
- com.hetzner.codespaces is run locally with cheapspaces MCP access
- No centralized orchestration layer exists yet

The node registry is not immediately useful in this setup but will be critical when we move to true multi-node orchestration.

---

## Design Overview

The Node Registry is the PM daemon's "address book" for managing a fleet of VPS nodes. It provides:

1. **Service Discovery**: Track all nodes in the fleet
2. **Health Monitoring**: Detect online/offline/degraded status
3. **Load Balancing**: Find best node for new work
4. **Cluster State**: Aggregate status across all nodes

---

## File Structure

```
seed/node-agent/src/services/daemon/node-registry.ts
```

---

## Core Types

```typescript
// Configuration from YAML file
interface NodeRegistryConfig {
  nodes: NodeConfig[];
}

interface NodeConfig {
  id: string;           // e.g., "worker-1"
  host: string;         // Tailscale IP or hostname
  port: number;         // Default: 8911
  label: string;        // Human-readable label
  location?: string;    // e.g., "nbg1", "fsn1", "hel1"
  server_type?: string; // e.g., "cax21", "cpx21"
}

// Runtime state with health status
interface RegisteredNode extends NodeConfig {
  status: "online" | "offline" | "degraded";
  last_seen?: string;
  node_status?: NodeStatus; // Cached /api/status response
}
```

---

## API Methods

### `loadConfig(configPath?: string): Promise<void>`
- Loads nodes from YAML file (default: `src/config/nodes.yaml`)
- Parses YAML and populates internal registry
- Initializes all nodes as "offline" until health check

### `getAllNodes(): RegisteredNode[]`
- Returns all registered nodes with their current status
- Includes cached node_status if available

### `getNode(id: string): RegisteredNode | undefined`
- Returns specific node by ID
- Used for targeting specific nodes in commands

### `getOnlineNodes(): RegisteredNode[]`
- Returns only nodes with status "online"
- Used for load balancing and work distribution

### `fetchNodeStatus(node: RegisteredNode): Promise<NodeStatus | null>`
- HTTP GET to `http://{host}:{port}/api/status`
- 10 second timeout
- Updates cached node_status and last_seen
- Returns null on failure (marks node offline)

### `healthCheckAll(): Promise<void>`
- Iterates all nodes and calls fetchNodeStatus
- Updates node status based on HTTP response
- Logs status changes (online ↔ offline)

### `startHealthChecks(intervalMs: number = 60000): void`
- Starts periodic health checks
- Default: every 60 seconds
- Returns control immediately (runs in background)

### `stopHealthChecks(): void`
- Stops periodic health checks
- Clears interval timer

---

## Configuration File

`src/config/nodes.yaml`:

```yaml
nodes:
  - id: worker-1
    host: 100.x.x.x  # Tailscale IP
    port: 8911
    label: "Worker 1 (cax21, nbg1)"
    location: nbg1
    server_type: cax21

  - id: worker-2
    host: 100.y.y.y
    port: 8911
    label: "Worker 2 (cpx21, fsn1)"
    location: fsn1
    server_type: cpx21

  - id: gpu-worker
    host: 100.z.z.z
    port: 8911
    label: "GPU Worker (hel1)"
    location: hel1
    server_type: accel-1
```

---

## YAML Parsing Helper

```typescript
private parseYamlConfig(content: string): NodeRegistryConfig {
  const lines = content.split('\n');
  const nodes: NodeConfig[] = [];
  let inNodes = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('nodes:')) {
      inNodes = true;
      continue;
    }

    if (!inNodes || !trimmed.startsWith('-')) continue;

    // Parse node entry
    const idMatch = trimmed.match(/id:\s*["']?([\w-]+)["']?/);
    const hostMatch = trimmed.match(/host:\s*["']?([\d.]+)["']?/);
    const portMatch = trimmed.match(/port:\s*(\d+)/);
    const labelMatch = trimmed.match(/label:\s*["'](.+?)["']/);
    const locationMatch = trimmed.match(/location:\s*(\w+)/);
    const typeMatch = trimmed.match(/server_type:\s*(\w+)/);

    if (idMatch && hostMatch && portMatch) {
      nodes.push({
        id: idMatch[1],
        host: hostMatch[1],
        port: parseInt(portMatch[1], 10),
        label: labelMatch?.[1] || idMatch[1],
        location: locationMatch?.[1],
        server_type: typeMatch?.[1],
      });
    }
  }

  return { nodes };
}
```

---

## Integration Points

### PM Commands Service
```typescript
// Commands that need node list:
async executeCommand(cmd: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse>
// /status, /nodes, /loops, /stop all use node registry
```

### PM Monitor Service
```typescript
// Monitor callback to get nodes:
startMonitoring(getNodes: () => RegisteredNode[], options: MonitorOptions)
// Called every interval to check all nodes for state changes
```

### PM Brain Service
```typescript
// Context includes nodes:
processMessage(message: string, context: { nodes: RegisteredNode[] }): Promise<PmBrainResponse>
// PM brain can query and operate on any registered node
```

---

## Usage Example

```typescript
const registry = new NodeRegistryService();

// Load configuration
await registry.loadConfig('./nodes.yaml');

// Start health checks
registry.startHealthChecks(60000); // Every 60 seconds

// Get nodes for operations
const allNodes = registry.getAllNodes();
const onlineNodes = registry.getOnlineNodes();

// Get specific node
const worker1 = registry.getNode('worker-1');
if (worker1?.status === 'online') {
  // Start Ralph on worker-1
}
```

---

## Future Enhancements

When implementing, consider:

1. **Dynamic Registration**: Nodes auto-register via API instead of static YAML
2. **Leader Election**: One node becomes "orchestrator" for the cluster
3. **Service Mesh**: Use mTLS for node-to-node communication
4. **Resource Scheduling**: Smart placement based on CPU/memory/availability
5. **Fault Tolerance**: Retry logic, circuit breakers for failed nodes
6. **Metrics**: Track uptime, response times, success rates per node
7. **Geolocation**: Route work to nearest node by region
8. **Cost Optimization**: Spin down idle nodes during off-hours

---

## Testing Strategy

1. **Unit Tests**: Mock HTTP responses for various scenarios
2. **Integration Tests**: Real nodes in isolated network
3. **Chaos Tests**: Kill nodes mid-operation, verify recovery
4. **Load Tests**: 100+ nodes in registry, health check performance

---

## References

- Original implementation: `.git/history/pm-daemon/node-registry.ts`
- PM Daemon Design: `docs/internal/docs/PM-DAEMON-DESIGN.md`
- Node API: `GET /api/status` returns `NodeStatus`
