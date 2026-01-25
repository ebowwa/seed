#!/bin/bash
# Start all Ralph agents (PM + 3 Workers)

SEED_DIR=/root/seed
LOG_DIR=${SEED_DIR}/logs
mkdir -p ${LOG_DIR}

echo "Starting Multi-Agent Ralph System..."
echo ""

# PM Ralph
echo "→ Starting PM Ralph..."
cd ${SEED_DIR}
nohup ./ralph.sh "You are PM Ralph. Read tasks from /root/seed/tasks/ and coordinate Worker-1, Worker-2, Worker-3. Output <promise>PROJECT COMPLETE</promise> when all workers finish." \
  --completion "PROJECT COMPLETE" \
  --max-iterations 100 > ${LOG_DIR}/pm-ralph.log 2>&1 &
echo "  PM Ralph started"

# Workers
echo "→ Starting Worker-1 (Backend/API)..."
nohup ./ralph.sh "Create Hono API server at /root/seed/api/server.ts with GET /api/status endpoint that returns status of all Ralph agents. Output <promise>WORKER-1 COMPLETE</promise>" \
  --completion "WORKER-1 COMPLETE" \
  --max-iterations 50 > ${LOG_DIR}/worker-1.log 2>&1 &
echo "  Worker-1 started"

echo "→ Starting Worker-2 (Frontend/UI)..."
nohup ./ralph.sh "Create React dashboard at /root/seed/dashboard/index.html showing 4 agent cards (PM, Worker-1, Worker-2, Worker-3) with status and iteration counts. Output <promise>WORKER-2 COMPLETE</promise>" \
  --completion "WORKER-2 COMPLETE" \
  --max-iterations 50 > ${LOG_DIR}/worker-2.log 2>&1 &
echo "  Worker-2 started"

echo "→ Starting Worker-3 (Tests/Docs)..."
nohup ./ralph.sh "Create tests for the API server and write API documentation at /root/seed/docs/API.md. Output <promise>WORKER-3 COMPLETE</promise>" \
  --completion "WORKER-3 COMPLETE" \
  --max-iterations 50 > ${LOG_DIR}/worker-3.log 2>&1 &
echo "  Worker-3 started"

echo ""
echo "✓ All Ralph agents started!"
echo ""
echo "Monitor logs:"
echo "  tail -f /root/seed/logs/pm-ralph.log"
echo "  tail -f /root/seed/logs/worker-1.log"
echo "  tail -f /root/seed/logs/worker-2.log"
echo "  tail -f /root/seed/logs/worker-3.log"
