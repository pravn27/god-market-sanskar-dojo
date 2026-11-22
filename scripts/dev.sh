#!/usr/bin/env bash
# Start the Sanskar Dojo locally: the FastAPI backend (SQLite database) and the Vite frontend.
#
#   scripts/dev.sh           install what is missing, start both; Ctrl-C stops both
#   scripts/dev.sh --test    run the backend and frontend test suites, then exit
#
# The backend port is fixed at 8765 because frontend/vite.config.ts proxies /api to it.
# The frontend port is 5173 unless SANSKAR_DOJO_WEB_PORT is set.
# See docs/operations/local-setup-and-run.md for prerequisites and troubleshooting.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT=8765
WEB_PORT="${SANSKAR_DOJO_WEB_PORT:-5173}"
LOG_DIR="$ROOT/.dev-logs"
API_LOG="$LOG_DIR/backend.log"
API_PID=""
WEB_PID=""

say() { printf '\033[1m[dev]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[dev] %s\033[0m\n' "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. See docs/operations/local-setup-and-run.md."
}

port_busy() {
  command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

stop_all() {
  for pid in "$WEB_PID" "$API_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

trap stop_all EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

need uv
need npm
need curl

cd "$ROOT"
mkdir -p "$LOG_DIR"

say "checking Python dependencies (uv sync)"
uv sync --quiet

if [[ ! -d frontend/node_modules ]]; then
  say "installing frontend dependencies (npm ci)"
  (cd frontend && npm ci)
fi

if [[ "${1:-}" == "--test" ]]; then
  say "backend tests"
  uv run pytest -q
  say "frontend tests and typecheck"
  (cd frontend && npm test && npm run typecheck)
  say "all tests passed"
  exit 0
fi

port_busy "$API_PORT" && die "port $API_PORT is already in use. Find the process with: lsof -nP -iTCP:$API_PORT -sTCP:LISTEN"
port_busy "$WEB_PORT" && die "port $WEB_PORT is already in use. Find the process with: lsof -nP -iTCP:$WEB_PORT -sTCP:LISTEN"

say "starting backend on http://127.0.0.1:$API_PORT (database: ${SANSKAR_DOJO_DB:-data/sanskar-dojo.sqlite3})"
"$ROOT/.venv/bin/uvicorn" sanskar_dojo_api.app:create_app --factory --host 127.0.0.1 --port "$API_PORT" \
  >"$API_LOG" 2>&1 &
API_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$API_PORT/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    tail -n 20 "$API_LOG" >&2
    die "the backend stopped during startup. Full log: $API_LOG"
  fi
  sleep 0.5
done
curl -fsS "http://127.0.0.1:$API_PORT/api/v1/health" >/dev/null 2>&1 \
  || die "the backend did not answer within 30 seconds. Log: $API_LOG"
say "backend is up"

say "starting frontend on http://localhost:$WEB_PORT (open http://localhost:$WEB_PORT/dojo)"
(cd frontend && exec ./node_modules/.bin/vite --port "$WEB_PORT" --strictPort) &
WEB_PID=$!
wait "$WEB_PID"
