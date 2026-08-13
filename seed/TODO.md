# Seed Node - Future Nodes Setup TODO

## ✅ Completed on seed-node-prod

### System Stabilization
- [x] Node agent service running cleanly
- [x] Telegram bot service running
- [x] Git repository cleaned up (removed stale worktrees)
- [x] Configuration properly set (.env created)
- [x] PM daemon disabled on worker node
- [x] Health check script created
- [x] Setup guide documented
- [x] MOTD configured with status display

### Documentation
- [x] `NODE-SETUP-GUIDE.md` - Complete setup and troubleshooting
- [x] `NODE-CURRENT-STATUS.md` - Current node state
- [x] `health-check.sh` - Automated health monitoring
- [x] `TODO.md` - This file

---

## 🚧 High Priority - Required for Multi-Node Operations

### 1. Automated Node Setup Script
**Location**: `/root/seed/scripts/setup-node.sh` (to be created)

**Requirements**:
```bash
#!/bin/bash
# One-command setup for new nodes

# - Detect OS and install dependencies
# - Install Bun runtime
# - Clone repositories (seed, ralph)
# - Set up systemd services
# - Create .env with proper defaults
# - Start services and verify health
# - Output node ID and connection info
```

**Use case**:
```bash
# On new VPS:
curl -fsSL https://raw.githubusercontent.com/ebowwa/seed/main/scripts/setup-node.sh | bash
```

### 2. Node Registration System
**Purpose**: Discover and track all nodes in the fleet

**Requirements**:
- Nodes auto-register on startup
- Central registry (could be a simple YAML file or database)
- Node metadata: ID, IP, capacity, capabilities
- Health status tracking

**Implementation options**:
1. Simple: Git-based registry in a shared repo
2. Better: Consul or etcd for service discovery
3. Best: Custom HTTP API endpoint

### 3. PM Daemon Configuration
**Purpose**: Orchestrate work across multiple nodes

**Requirements**:
```yaml
# /root/seed/node-agent/src/config/nodes.yaml

nodes:
  - id: seed-node-prod
    capacity:
      max_loops: 2
      cpu_cores: 2
      memory_gb: 3.7
    capabilities:
      - ralph-iterative
      - code-execution
    pm_daemon: false  # Worker node

  - id: seed-node-coordinator
    capacity:
      max_loops: 4
      cpu_cores: 4
      memory_gb: 8
    capabilities:
      - ralph-iterative
      - code-execution
      - pm-coordinator
    pm_daemon: true   # Coordinator node
```

### 4. GitHub Token Management
**Issue**: Currently hardcoded in .env

**Solutions**:
1. Use Doppler for secrets (already have project)
2. Create a dedicated GitHub app for the fleet
3. Generate scoped tokens per node

**Action required**: Move GITHUB_TOKEN to Doppler secrets

---

## 📋 Medium Priority - Monitoring & Operations

### 5. Centralized Monitoring
**Purpose**: Health and metrics from all nodes

**Options**:
1. Simple: Cron job pushing to a centralized API endpoint
2. Better: Prometheus + Grafana
3. Full: Datadog or CloudWatch

**Quick win**: Simple health report endpoint on coordinator

### 6. Alerting System
**Triggers**:
- Node goes offline
- High CPU/memory for extended period
- Service failures
- Disk space low

**Delivery**: Telegram notification (already have bot running)

### 7. Log Aggregation
**Purpose**: Centralized logs for debugging

**Options**:
1. Loki (Grafana stack) - lightweight
2. Elasticsearch + Kibana - full featured
3. Simple: Syslog to central server

---

## 🔧 Low Priority - Enhancements

### 8. Auto-Scaling
**Trigger**: When queue depth > available capacity

**Requirements**:
- Detect when work is queuing
- Spin up new VPS via provider API
- Run setup script automatically
- Register in node pool
- Shut down when idle

### 9. Work Distribution Strategy
**Current**: First available node gets work

**Enhancements**:
- Least-loaded node scheduling
- Capability-based routing
- Affinity rules (same node for related work)
- Dead letter queue for failed work

### 10. Security Hardening
**Items**:
- [ ] Rotate GitHub tokens regularly
- [ ] Implement rate limiting on API
- [ ] Add authentication to node-agent API
- [ ] Network segmentation between nodes
- [ ] Regular security audits

---

## 📝 Node Provisioning Checklist

Use this when setting up new nodes:

### Before Provisioning
- [ ] VPS specs validated (2+ CPU, 4GB+ RAM, 50GB+ disk)
- [ ] DNS configured (if needed)
- [ ] Tailscale auth key generated
- [ ] GitHub token created with proper scopes
- [ ] Doppler project access confirmed

### Provisioning Steps
- [ ] Create VPS (Hetzner/DigitalOcean/AWS/etc.)
- [ ] SSH access configured (key-based auth only)
- [ ] Run automated setup script (once created)
- [ ] Verify Tailscale connection
- [ ] Verify services started
- [ ] Run health check script
- [ ] Register node in fleet config
- [ ] Add to monitoring

### Post-Setup Verification
- [ ] `/root/seed/health-check.sh` passes
- [ ] Node agent API responds
- [ ] Can create worktree via API
- [ ] Can run Ralph loop via API
- [ ] Logs flowing to monitoring
- [ ] Alerts configured

---

## 🔍 Known Issues

### seed-node-prod
- [ ] Pending reboot for kernel update (libc6, linux-image)
- [ ] 1 additional ESM update available (non-critical)
- [ ] GitHub token in .env should move to Doppler

### General
- [ ] No automated setup script yet
- [ ] No node registration system
- [ ] PM daemon incomplete
- [ ] No centralized monitoring
- [ ] No alerting configured

---

## 🎯 Next Actions (In Order of Priority)

### Immediate (This Week)
1. ✅ Stabilize seed-node-prod - DONE
2. 🔜 Create automated setup script
3. 🔜 Move GITHUB_TOKEN to Doppler
4. 🔜 Test node provisioning from scratch

### Short Term (Next 2 Weeks)
5. 🔜 Set up node registration system
6. 🔜 Configure PM daemon on coordinator node
7. 🔜 Set up basic monitoring/alerting

### Medium Term (Next Month)
8. 🔜 Provision 2-3 worker nodes
9. 🔜 Test multi-node work distribution
10. 🔜 Implement auto-scaling trigger

### Long Term (Ongoing)
11. 🔜 Security hardening
12. 🔜 Performance optimization
13. 🔜 Documentation improvements

---

## 📚 Resources

### Documentation
- `/root/seed/NODE-SETUP-GUIDE.md` - Setup and troubleshooting
- `/root/seed/NODE-CURRENT-STATUS.md` - Current state

### Scripts
- `/root/seed/health-check.sh` - Health monitoring

### Repositories
- https://github.com/ebowwa/seed - Node agent and orchestration
- https://github.com/ebowwa/ralph - Ralph Iterative

### Services
- Doppler: https://dashboard.doppler.com/project/seed/prd

---

*Last Updated: 2026-02-13*
*Status: seed-node-prod stable, ready for multi-node expansion*
