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
sh scripts/engine-contract-prepare.sh > tmp/engine-contract.log 2>&1 || { tail -20 tmp/engine-contract.log; exit 1; }
LKJSTR_ENGINE_HARNESS=1 sh scripts/engine-build.sh > tmp/engine-build.log 2>&1 || { tail -30 tmp/engine-build.log; exit 1; }
if [ "${LKJSTR_COLD_START:-0}" = "1" ]; then
  cargo run -q --release -p lkjstr-core --example engine-cold-fixtures > tmp/engine-pkg/cold-fixtures.json 2> tmp/cold-fixtures.log || { tail -10 tmp/cold-fixtures.log; exit 1; }
fi
node scripts/engine-harness.mjs > tmp/engine-harness.log 2>&1 || {
  node -e 'const r=require("./tmp/engine-harness/report.json");console.error(r.checks.failure??r.errors)'; exit 1;
}
node scripts/engine-profile-latency.mjs > tmp/engine-profile-latency.log 2>&1 || { tail -20 tmp/engine-profile-latency.log; exit 1; }
echo 'ok engine-conformance'
