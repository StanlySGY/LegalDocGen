#!/bin/bash
set -e

# Start nginx in background
nginx &

# Start backend
cd /app
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8002 &

# Wait for any process to exit
wait -n
exit $?
