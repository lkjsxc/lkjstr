#!/bin/bash
# Ship one clean, tested main commit; keep logs and exact host receipts in tmp/.
# The first account-fenced release uses --establish-rollback-baseline once.
set -uo pipefail
export LKJSTR_WASM_BINDGEN=${LKJSTR_WASM_BINDGEN:-$HOME/.cache/trunk/wasm-bindgen-0.2.122/wasm-bindgen}
export CARGO_BUILD_JOBS=4 RUST_TEST_THREADS=4 CARGO_INCREMENTAL=0
export CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 GIT_TERMINAL_PROMPT=0
export PATH="$PATH:$HOME/.cargo/bin"
NOTE=${1:?one Japanese line for the owner}
MODE=${2:-}
[[ $# -le 2 && ( -z "$MODE" || "$MODE" = --establish-rollback-baseline ) ]] || exit 2
W=$(git rev-parse --show-toplevel) || exit 2
R=/root/forgejo-restore-20260906T232532/repos/bootstrap-infra
STATE=${LKJSTR_SHIP_STATE_DIR:-$HOME/.local/state}
mkdir -p "$W/tmp" "$STATE" || exit 2
exec 9>"$STATE/lkjstr-ship.lock"
flock -w 7200 9 || exit 1
# Acquire the shared lock before replacing another attempt's result/log.
: > "$W/tmp/ship.out"
exec >"$W/tmp/ship.log" 2>&1
end() { printf '%s\n' "$1" >> "$W/tmp/ship.out"; exit "$2"; }
fail() { end "NOT SHIPPED: $1" 1; }
clean() { local STATUS; STATUS=$(git status --porcelain) && [[ -z "$STATUS" ]]; }
LAST="$STATE/lkjstr-last-ship"
if [[ -f "$LAST" ]]; then
  read -r LAST_TIME LAST_COMMIT < "$LAST" || fail 'invalid last-ship record'
  [[ "$LAST_TIME" =~ ^[0-9]+$ ]] || fail 'invalid last-ship time'
  (( $(date +%s) - LAST_TIME >= 7200 )) || fail 'the previous ship was less than two hours ago'
fi
cd "$W" || fail 'no worktree'
clean || fail 'uncommitted changes or unreadable worktree'
git fetch -q origin main || fail 'cannot fetch main'
git merge-base --is-ancestor origin/main HEAD || fail 'origin/main is not in HEAD: rebase first'
REVISION=$(git rev-parse HEAD) || fail 'no revision'
C=$(git rev-parse --short HEAD) || fail 'no short revision'
RUN="$W/tmp/ship-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$RUN" || fail 'cannot retain ship evidence'
cd "$W/web" || fail 'no web/'
timeout 1800 pnpm check || fail 'pnpm check'
LKJSTR_SHOTS=1 timeout 2400 pnpm smoke:real || LKJSTR_SHOTS=1 timeout 2400 pnpm smoke:real || fail 'pnpm smoke:real (twice)'
timeout 1200 pnpm build:real && pnpm package || fail 'build:real or package'
cd "$W" || fail 'no worktree after build'
[[ "$(git rev-parse HEAD)" = "$REVISION" ]] && clean || fail 'source changed during verification'
T="$W/tmp/lkjstr-dist.tar.gz"
H=$(sha256sum "$T" | cut -d' ' -f1) || fail 'no package digest'
I=$(tar xzOf "$T" ./index.html | sha256sum | cut -d' ' -f1) || fail 'no packaged index'
[[ "$H" =~ ^[a-f0-9]{64}$ && "$I" =~ ^[a-f0-9]{64}$ ]] || fail 'invalid package digest'
cp "$T" "$RUN/lkjstr-dist.tar.gz" || fail 'cannot retain the exact archive'
printf '%s\n' "$REVISION" > "$RUN/revision"
# Authentication or a concurrent main update must fail before any live change.
git push -q origin HEAD:main || fail 'cannot push the tested commit; live is unchanged'
git fetch -q origin main || fail 'cannot confirm main; live is unchanged'
[[ "$(git rev-parse origin/main)" = "$REVISION" ]] || fail 'main changed after verification; live is unchanged'
REMOTE="/root/lkjstr-inbox/lkjstr-dist-$C-$H.tar.gz"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=20 root@archserver)
"${SSH[@]}" 'mkdir -p /root/lkjstr-inbox' &&
  "${SSH[@]}" "cat > $REMOTE && sha256sum $REMOTE" < "$T" | grep -q "^$H " || fail 'cannot send the exact package'
# Only exit 75 means the host refused before activation because its lock is busy.
# Transport failure and other errors are not safe reasons to repeat a deployment.
host() {
  local ACTION=$1 OUTPUT=$2 ATTEMPT=0 CODE
  while :; do
    "${SSH[@]}" "cd $R && python3 -B ops/lkjstr.py $ACTION" > "$OUTPUT"
    CODE=$?
    (( CODE == 0 )) && return 0
    (( CODE == 75 )) || return "$CODE"
    ATTEMPT=$((ATTEMPT + 1))
    (( ATTEMPT < 40 )) || return 75
    sleep 60
  done
}
deploy() {
  local SLOT=$1 BEFORE=${2:-}
  host "deploy $REMOTE $H" "$RUN/deploy-$SLOT.json" || return 1
  node "$W/scripts/ship-receipt.mjs" deploy "$RUN/deploy-$SLOT.json" "$H" "$I" "$BEFORE" || return 1
}
verify() {
  local SLOT=$1
  host verify "$RUN/verify-$SLOT.json" || return 1
  node "$W/scripts/ship-receipt.mjs" verify "$RUN/verify-$SLOT.json" "$H" "$I"
}
FIRST=$(deploy first) || fail 'host deployment did not finish; inspect its receipt and current release'
verify first || fail 'live verification failed; inspect the receipt and current release'
CURRENT=$FIRST
if [[ "$MODE" = --establish-rollback-baseline ]]; then
  CURRENT=$(deploy baseline "$FIRST") || fail 'the first safe release is verified; compatible rollback baseline is incomplete'
  verify baseline || fail 'the first safe release is verified; compatible rollback baseline verification is incomplete'
fi
printf '%s %s\n' "$(date +%s)" "$REVISION" > "$LAST.$$" && mv "$LAST.$$" "$LAST" ||
  end "SHIPPED $C sha256=$H current=$CURRENT; last-ship record failed" 1
printf 'revision=%s\narchive=%s\nindex=%s\ncurrent=%s\nfirst=%s\nmode=%s\n' \
  "$REVISION" "$H" "$I" "$CURRENT" "$FIRST" "$MODE" > "$RUN/summary"
# Cargo's own clean lock and a repository process check protect active builds/tests.
node "$W/scripts/ship-clean.mjs" "$W" || printf '%s\n' 'Debug cleanup deferred: an owned build/test is active or cleanup failed.'
if ! desk note "lkjstr を更新: $NOTE https://lkjstr.lkjsxc.com" --from chatgpt-lkjstr; then
  end "SHIPPED $C sha256=$H current=$CURRENT; desk note failed" 1
fi
end "SHIPPED $C sha256=$H current=$CURRENT baseline=$FIRST" 0
