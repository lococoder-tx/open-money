#!/usr/bin/env bash
# Read-only: is the instance from launch.sh worth driving? Needs RUN_DIR, API_PORT, WEB_PORT.
set -uo pipefail
: "${RUN_DIR:?export the vars launch.sh printed}" "${API_PORT:?}" "${WEB_PORT:?}"
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
ok=0
check() { if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FAIL  $1"; ok=1; fi; }
owner() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null; }
descends() { local p=${1:-} want=${2:-}; [ -n "$p" ] || return 1; while [ -n "$p" ] && [ "$p" != 1 ]; do [ "$p" = "$want" ] && return 0; p=$(ps -o ppid= -p "$p" | tr -d ' '); done; return 1; }
check "server process alive" "kill -0 $(cat "$RUN_DIR/server.pid")"
check "web process alive" "kill -0 $(cat "$RUN_DIR/web.pid")"
check "port $API_PORT owned by this run" "descends $(owner "$API_PORT" | head -1) $(cat "$RUN_DIR/server.pid")"
check "port $WEB_PORT owned by this run" "descends $(owner "$WEB_PORT" | head -1) $(cat "$RUN_DIR/web.pid")"
check "API answers through the web proxy" "curl -sf http://localhost:$WEB_PORT/api/accounts"
check "web serves the TanStack Router entry" "curl -sf http://localhost:$WEB_PORT/src/main.tsx | grep -q RouterProvider"
echo "build: $(git -C "$REPO" rev-parse --short HEAD)$(git -C "$REPO" diff --quiet || echo '+dirty')"
echo "db:    $RUN_DIR/rocket.db ($(sqlite3 "$RUN_DIR/rocket.db" 'select count(*) from transactions' 2>/dev/null || echo 0) transactions)"
exit $ok
