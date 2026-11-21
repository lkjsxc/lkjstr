#!/bin/bash
# Loaded in full from the pinned Git revision by ship.sh before any gate runs.
set -uo pipefail
export LKJSTR_WASM_BINDGEN=${LKJSTR_WASM_BINDGEN:-$HOME/.cache/trunk/wasm-bindgen-0.2.122/wasm-bindgen}
export CARGO_BUILD_JOBS=4 RUST_TEST_THREADS=4 CARGO_INCREMENTAL=0
export CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 GIT_TERMINAL_PROMPT=0
export PATH="$PATH:$HOME/.cargo/bin"
# Build XDG directories must not hide the existing GitHub login.
# An explicit GH_CONFIG_DIR or a login in the chosen XDG directory wins.
if [[ -z "${GH_CONFIG_DIR:-}" && ! -f "${XDG_CONFIG_HOME:-$HOME/.config}/gh/hosts.yml" && -f "$HOME/.config/gh/hosts.yml" ]]; then
  export GH_CONFIG_DIR="$HOME/.config/gh"
fi
NOTE=${1:?owner note}
MODE=${2-}
W=${3:?worktree}
REVISION=${4:?tested revision}
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
NOTIFY=${LKJSTR_SHIP_NOTIFY:-1}
[[ "$NOTIFY" == 0 || "$NOTIFY" == 1 ]] || fail 'LKJSTR_SHIP_NOTIFY must be 0 or 1'
cd "$W" || fail 'no worktree'
[[ "$(git rev-parse HEAD)" = "$REVISION" ]] && clean || fail 'uncommitted changes or unreadable worktree'
git fetch -q origin main || fail 'cannot fetch main'
git merge-base --is-ancestor origin/main "$REVISION" || fail 'origin/main is not in HEAD: rebase first'
C=$(git rev-parse --short "$REVISION") || fail 'no short revision'
# Authenticate before the costly gates; both pushes name the pinned tested revision.
git push --dry-run -q origin "$REVISION:refs/heads/main" ||
  fail 'cannot authenticate the tested-source push; live is unchanged'
RUN=$(mktemp -d "$W/tmp/ship-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX") || fail 'cannot retain ship evidence'
RECEIPT_CODE=$(git show "$REVISION:scripts/ship-receipt.mjs") || fail 'cannot snapshot receipt validator'
CLEANUP_CODE=$(git show "$REVISION:scripts/ship-clean.mjs") || fail 'cannot snapshot cleanup policy'
# These are the exact argument bytes that bash and Node execute, never reread from the worktree.
printf '%s' "$BASH_EXECUTION_STRING" > "$RUN/ship-run.sh" &&
  printf '%s' "$RECEIPT_CODE" > "$RUN/ship-receipt.mjs" &&
  printf '%s' "$CLEANUP_CODE" > "$RUN/ship-clean.mjs" &&
  git show "$REVISION:scripts/ship.sh" > "$RUN/ship.sh" &&
  printf '%s\n' "$REVISION" > "$RUN/revision" || fail 'cannot retain executed scripts'
sha256sum "$RUN/ship.sh" "$RUN/ship-run.sh" "$RUN/ship-receipt.mjs" "$RUN/ship-clean.mjs" \
  > "$RUN/scripts.sha256" || fail 'cannot bind executed scripts'
chmod a-w "$RUN/ship.sh" "$RUN/ship-run.sh" "$RUN/ship-receipt.mjs" "$RUN/ship-clean.mjs" ||
  fail 'cannot protect retained scripts'
# Copied package fixtures resolve TypeScript from the repository root.
timeout 300 pnpm install --frozen-lockfile || fail 'pnpm install --frozen-lockfile (root)'
cd "$W/web" || fail 'no web/'
timeout 1800 pnpm check || fail 'pnpm check'
smoke_attempt() {
  local ATTEMPT="$RUN/smoke-$1" CODE=0
  mkdir "$ATTEMPT" || fail 'cannot create smoke evidence directory'
  printf 'Smoke attempt %s evidence: %s\n' "$1" "$ATTEMPT"
  LKJSTR_SHOTS=1 LKJSTR_SMOKE_OUTPUT="$ATTEMPT" timeout 2400 pnpm smoke:real \
    > "$ATTEMPT/stdout" 2> "$ATTEMPT/stderr" || CODE=$?
  printf '%s\n' "$CODE" > "$ATTEMPT/status" || fail 'cannot retain smoke status'
  cat "$ATTEMPT/stdout" && cat "$ATTEMPT/stderr" >&2 || fail 'cannot read smoke logs'
  return "$CODE"
}
smoke_attempt 1 || smoke_attempt 2 || fail 'pnpm smoke:real (twice)'
timeout 1200 pnpm build:real && pnpm package || fail 'build:real or package'
cd "$W" || fail 'no worktree after build'
T="$RUN/lkjstr-dist.tar.gz"
cp "$W/tmp/lkjstr-dist.tar.gz" "$T" && chmod a-w "$T" || fail 'cannot retain the exact archive'
[[ "$(git rev-parse HEAD)" = "$REVISION" ]] && clean || fail 'source changed during verification'
H=$(sha256sum "$T" | cut -d' ' -f1) || fail 'no package digest'
I=$(tar xzOf "$T" ./index.html | sha256sum | cut -d' ' -f1) || fail 'no packaged index'
[[ "$H" =~ ^[a-f0-9]{64}$ && "$I" =~ ^[a-f0-9]{64}$ ]] || fail 'invalid package digest'
# Authentication or a concurrent main update must fail before any live change.
git push -q origin "$REVISION:refs/heads/main" || fail 'cannot push the tested commit; live is unchanged'
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
  node --input-type=module --eval "$RECEIPT_CODE" ship-receipt deploy "$RUN/deploy-$SLOT.json" "$H" "$I" "$BEFORE" || return 1
}
verify() {
  local SLOT=$1
  host verify "$RUN/verify-$SLOT.json" || return 1
  node --input-type=module --eval "$RECEIPT_CODE" ship-receipt verify "$RUN/verify-$SLOT.json" "$H" "$I"
}
FIRST=$(deploy first) || fail 'host deployment did not finish; inspect its receipt and current release'
verify first || fail 'live verification failed; inspect the receipt and current release'
CURRENT=$FIRST
if [[ "$MODE" = --establish-rollback-baseline ]]; then
  CURRENT=$(deploy baseline "$FIRST") || fail 'the first safe release is verified; compatible rollback baseline is incomplete'
  verify baseline || fail 'the first safe release is verified; compatible rollback baseline verification is incomplete'
fi
LAST="$STATE/lkjstr-last-ship"
printf '%s %s\n' "$(date +%s)" "$REVISION" > "$LAST.$$" && mv "$LAST.$$" "$LAST" ||
  end "SHIPPED $C sha256=$H current=$CURRENT; last-ship record failed" 1
printf 'revision=%s\narchive=%s\nindex=%s\ncurrent=%s\nfirst=%s\nmode=%s\n' \
  "$REVISION" "$H" "$I" "$CURRENT" "$FIRST" "$MODE" > "$RUN/summary"
node --input-type=module --eval "$CLEANUP_CODE" ship-clean "$W" ||
  printf '%s\n' 'Debug cleanup deferred: cleanup policy could not finish.'
if [[ "$NOTIFY" == 0 ]]; then
  printf '%s\n' 'Owner notification deferred for the release summary.'
elif ! desk note "lkjstr を更新: $NOTE https://lkjstr.lkjsxc.com" --from chatgpt-lkjstr; then
  end "SHIPPED $C sha256=$H current=$CURRENT; desk note failed" 1
fi
end "SHIPPED $C sha256=$H current=$CURRENT baseline=$FIRST" 0
