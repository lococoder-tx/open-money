#!/usr/bin/env bash
# Start an isolated API + web instance for verification. Prints the env to export.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
RUN_ID="${RUN_ID:-$(date +%s)}"
API_PORT="${API_PORT:-3102}"
WEB_PORT="${WEB_PORT:-5182}"
RUN_DIR="${TMPDIR:-/tmp}/rocket-verify-$RUN_ID"

for port in "$API_PORT" "$WEB_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $port is taken; set API_PORT/WEB_PORT to free ports" >&2
    exit 1
  fi
done

mkdir -p "$RUN_DIR"
if [ -f "$REPO/rocket.db" ]; then
  sqlite3 "$REPO/rocket.db" ".backup '$RUN_DIR/rocket.db'"
  echo "seeded from $REPO/rocket.db" >&2
else
  echo "no rocket.db in repo root: starting empty (dashboard shows the connect screen)" >&2
fi

: "${PLAID_CLIENT_ID:=verify-placeholder}" "${PLAID_SECRET:=verify-placeholder}"
: "${ENCRYPTION_KEY:=$(printf '0%.0s' {1..64})}"
export PLAID_CLIENT_ID PLAID_SECRET ENCRYPTION_KEY

# exec so no wrapper shell outlives the redirect and holds the caller's $(...) pipe open.
(cd "$REPO" && PORT="$API_PORT" DATABASE_PATH="$RUN_DIR/rocket.db" exec nohup npx tsx server/src/index.ts) \
  >"$RUN_DIR/server.log" 2>&1 </dev/null &
echo $! >"$RUN_DIR/server.pid"
(cd "$REPO/web" && API_PORT="$API_PORT" exec nohup npx vite --port "$WEB_PORT" --strictPort) \
  >"$RUN_DIR/web.log" 2>&1 </dev/null &
echo $! >"$RUN_DIR/web.pid"

for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$WEB_PORT/api/institutions" >/dev/null &&
    curl -sf "http://localhost:$WEB_PORT/" | grep 'id="root"' >/dev/null; then
    echo "export RUN_ID=$RUN_ID RUN_DIR=$RUN_DIR API_PORT=$API_PORT WEB_PORT=$WEB_PORT BASE_URL=http://localhost:$WEB_PORT"
    exit 0
  fi
  sleep 0.5
done
echo "not ready after 30s; see $RUN_DIR/server.log and $RUN_DIR/web.log" >&2
exit 1
