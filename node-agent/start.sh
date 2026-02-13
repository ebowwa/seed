#!/bin/bash
export PATH=/root/.bun/bin:/usr/local/bin:/usr/bin:/bin
cd /root/seed/node-agent
exec /root/.bun/bin/bun run src/index.ts
