#!/bin/bash
# Pin the driver before a long verification run can replace a worktree script.
set -uo pipefail
NOTE=${1:?one Japanese line for the owner}
MODE=${2:-}
[[ $# -le 2 && ( -z "$MODE" || "$MODE" = --establish-rollback-baseline ) ]] || exit 2
W=$(git rev-parse --show-toplevel) || exit 2
REVISION=$(git -C "$W" rev-parse HEAD) || exit 2
SCRIPT=$(git -C "$W" show "$REVISION:scripts/ship-run.sh") || exit 2
exec /bin/bash -c "$SCRIPT" ship-run "$NOTE" "$MODE" "$W" "$REVISION"
