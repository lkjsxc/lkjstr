#!/bin/sh
# Protocol drift is a separate headless gate, with a fresh loopback relay and data.
set -eu
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_BUILD_JOBS=4 RUST_TEST_THREADS=4
export CARGO_HOME="${CARGO_HOME:-$PWD/tmp/cargo-home}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$PWD/tmp/cache}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$PWD/tmp/config}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$PWD/tmp/data}"
export TMPDIR="${LKJSTR_ENGINE_TMPDIR:-$PWD/tmp/temp}"
mkdir -p "$TMPDIR"
node --test scripts/engine-transport-private.test.mjs scripts/engine-transport-history.test.mjs scripts/engine-transport-zaps.test.mjs scripts/engine-transport-reading.test.mjs scripts/engine-transport-lists.test.mjs scripts/engine-transport-auth.test.mjs scripts/engine-transport-storage.test.mjs > tmp/engine-transport.log 2>&1 || { tail -20 tmp/engine-transport.log; exit 1; }
node --test scripts/real-hour-test.mjs scripts/real-hour-network-test.mjs scripts/real-hour-owned-test.mjs scripts/real-hour-history-test.mjs > tmp/real-hour-observer.log 2>&1 || { tail -20 tmp/real-hour-observer.log; exit 1; }
node --test scripts/engine-contract.test.mjs scripts/engine-production-check.test.mjs > tmp/engine-contract-tests.log 2>&1 || { tail -20 tmp/engine-contract-tests.log; exit 1; }
sh scripts/engine-contract-prepare.sh > tmp/engine-contract.log 2>&1 || { tail -20 tmp/engine-contract.log; exit 1; }
cargo build -q -p lkjstr-nips --example zap-fixtures > tmp/zap-fixtures-build.log 2>&1 || { tail -20 tmp/zap-fixtures-build.log; exit 1; }
LKJSTR_ENGINE_HARNESS=1 sh scripts/engine-build.sh > tmp/engine-build.log 2>&1 || { tail -30 tmp/engine-build.log; exit 1; }
LKJSTR_ENGINE_REPORT=tmp/storage-gate node scripts/engine-storage.mjs > tmp/storage-gate.log 2>&1 || { tail -20 tmp/storage-gate.log; exit 1; }
cargo build -q -p lkjstr-core --example engine-fixtures --example engine-bunker > tmp/engine-helper-build.log 2>&1 || { tail -20 tmp/engine-helper-build.log; exit 1; }
LKJSTR_ENGINE_REPORT=tmp/engine-mentions node scripts/engine-mentions.mjs > tmp/engine-mentions.log 2>&1 || { tail -20 tmp/engine-mentions.log; exit 1; }
LKJSTR_ENGINE_REPORT=tmp/history-route-gate node scripts/engine-history-route.mjs > tmp/history-route-gate.log 2>&1 || { tail -20 tmp/history-route-gate.log; exit 1; }
LKJSTR_ENGINE_REPORT=tmp/live-route-gate node scripts/engine-live-route.mjs > tmp/live-route-gate.log 2>&1 || { tail -20 tmp/live-route-gate.log; exit 1; }
if [ "${LKJSTR_COLD_START:-0}" = "1" ]; then
  cargo run -q --release -p lkjstr-core --example engine-cold-fixtures > tmp/engine-pkg/cold-fixtures.json 2> tmp/cold-fixtures.log || { tail -10 tmp/cold-fixtures.log; exit 1; }
fi
cargo build -q -p lkjstr-nips --example list-fixtures > tmp/engine-list-helper.log 2>&1 || { tail -20 tmp/engine-list-helper.log; exit 1; }
LKJSTR_ENGINE_REPORT=tmp/engine-bunker-auth node scripts/engine-bunker-auth.mjs > tmp/engine-bunker-auth.log 2>&1 || { tail -20 tmp/engine-bunker-auth.log; exit 1; }
LKJSTR_ENGINE_REPORT=tmp/engine-bunker-auth-boundaries node scripts/engine-bunker-auth.mjs --boundaries > tmp/engine-bunker-auth-boundaries.log 2>&1 || { tail -20 tmp/engine-bunker-auth-boundaries.log; exit 1; }
LKJSTR_ENGINE_REPORT=tmp/engine-private-lists node scripts/engine-private-lists.mjs > tmp/engine-private-lists.log 2>&1 || { tail -20 tmp/engine-private-lists.log; exit 1; }
LKJSTR_ENGINE_REPORT=tmp/engine-emoji node scripts/engine-emoji.mjs > tmp/engine-emoji.log 2>&1 || { tail -20 tmp/engine-emoji.log; exit 1; }
mkdir -p tmp/engine-stop
rm -f tmp/engine-stop/report.json
LKJSTR_ENGINE_REPORT=tmp/engine-stop node scripts/engine-stop.mjs > tmp/engine-stop.log 2>&1 || {
  node -e 'try { const r=JSON.parse(require("fs").readFileSync("tmp/engine-stop/report.json","utf8")); const failed=r.checks.filter(c=>!c.ok); console.error("engine-stop: "+String(r.failure??(failed.length+" failed: "+failed.slice(0,3).map(c=>c.name).join("; "))).replace(/\s+/g," ").slice(0,400)); } catch { console.error("engine-stop failed; see tmp/engine-stop.log"); }'
  exit 1
}
LKJSTR_ENGINE_REPORT=tmp/engine-dm-sign-deadlines node scripts/engine-dm-sign-deadline-harness.mjs > tmp/engine-dm-sign-deadlines.log 2>&1 || { tail -20 tmp/engine-dm-sign-deadlines.log; exit 1; }
mkdir -p tmp/engine-harness
rm -f tmp/engine-harness/report.json
node scripts/engine-harness.mjs > tmp/engine-harness.log 2>&1 || {
  node -e 'try { const r=JSON.parse(require("fs").readFileSync("tmp/engine-harness/report.json","utf8")); console.error(String(r.checks?.failure??JSON.stringify(r.errors)).slice(0,400)); } catch { console.error("No completed main harness report; original log follows."); }'
  tail -c 4000 tmp/engine-harness.log >&2 || true
  exit 1
}
LKJSTR_ENGINE_REPORT=tmp/relay-progressive-worker node scripts/engine-relay-progressive.mjs > tmp/relay-progressive-worker.log 2>&1 || { tail -20 tmp/relay-progressive-worker.log; exit 1; }
node scripts/engine-profile-latency.mjs > tmp/engine-profile-latency.log 2>&1 || { tail -20 tmp/engine-profile-latency.log; exit 1; }
echo 'ok engine-conformance'
