#!/usr/bin/env bash
# Stop the processes launch.sh started and delete the disposable DB. Evidence in .verify-artifacts/ is kept.
set -uo pipefail
: "${RUN_DIR:?export the vars launch.sh printed}"
kill_tree() {
  for child in $(pgrep -P "$1"); do kill_tree "$child"; done
  kill "$1" 2>/dev/null
}
for f in server web; do
  pid=$(cat "$RUN_DIR/$f.pid" 2>/dev/null) || continue
  kill_tree "$pid"
done
sleep 1
rm -rf "$RUN_DIR"
echo "stopped run; removed $RUN_DIR"
