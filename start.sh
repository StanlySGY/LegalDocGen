#!/bin/bash
set -e
cd "$(dirname "$0")"

fuser -k 8002/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
sleep 1

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8002 2>&1 &
cd frontend && npx vite --host 2>&1 &
cd ..

sleep 3
echo ""
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8002"
echo ""

trap "kill 0 2>/dev/null" INT TERM
wait
