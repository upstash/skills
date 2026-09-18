#!/bin/bash
# Full take: fresh TUI session, recorded run, outcome clip. Usage: ./take.sh <name>
set -eo pipefail
cd /workspace/home/recorder
set -a; . ./.env; set +a
name=$1
find /workspace/home/demo -mindepth 1 ! -name opencode.json ! -name AGENTS.md -exec rm -rf {} + 2>/dev/null || true
./start-session.sh
sleep 4
npx tsx rec.mts "$name"
npx tsx outcome.mts "$name"
echo TAKE_DONE
