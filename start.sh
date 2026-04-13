#!/bin/bash
# Hermes Web UI — start/restart wrapper
# Usage: ./start.sh [start|stop|status]

DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.hermes-web-ui/webui.pid"
LOG_FILE="$DIR/.hermes-web-ui/server.log"
NODE_BIN="$(which node 2>/dev/null || echo "/home/xiao2027/.local/bin/node")"

mkdir -p "$DIR/.hermes-web-ui"

is_running() {
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

do_start() {
  if is_running; then
    echo "Already running (PID $(cat "$PID_FILE"))"
    exit 0
  fi

  echo "Starting Hermes Web UI on port 8650..."
  while true; do
    nohup "$NODE_BIN" "$DIR/dist/server/index.js" >> "$LOG_FILE" 2>&1 &
    pid=$!
    echo "$pid" > "$PID_FILE"
    echo "  Started (PID $pid, port 8650)"
    echo "  http://localhost:8650"

    # Wait for process to exit
    wait "$pid"
    exit_code=$?

    # Exit code 42 = restart requested from UI
    if [ "$exit_code" -eq 42 ]; then
      echo "  ↻ Restarting..."
      sleep 1
      continue
    fi

    # Normal exit or error — stop
    rm -f "$PID_FILE"
    echo "  Stopped (exit code $exit_code)"
    break
  done
}

do_stop() {
  if ! is_running; then
    echo "Not running"
    exit 0
  fi
  pid=$(cat "$PID_FILE")
  echo "Stopping Web UI (PID $pid)..."
  kill "$pid" 2>/dev/null
  sleep 1
  kill -9 "$pid" 2>/dev/null
  rm -f "$PID_FILE"
  echo "  Stopped"
}

do_status() {
  if is_running; then
    echo "Running (PID $(cat "$PID_FILE"), port 8650)"
  else
    echo "Not running"
  fi
}

case "${1:-start}" in
  start)  do_start ;;
  stop)   do_stop ;;
  status) do_status ;;
  restart) do_stop; sleep 1; do_start ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
