#!/bin/sh
# All output lives in ignored worktree paths. No services or deployments.
set -eu
export CARGO_BUILD_JOBS=4
engine_features=""
if [ "${LKJSTR_ENGINE_HARNESS:-0}" = "1" ]; then engine_features="--features=harness"; fi
cargo build --release $engine_features -p lkjstr-engine-worker --target wasm32-unknown-unknown
bindgen="${LKJSTR_WASM_BINDGEN:-wasm-bindgen}"
if ! command -v "$bindgen" >/dev/null 2>&1; then
  bindgen="$PWD/tmp/cache/wasm-bindgen/wasm-bindgen"
fi
"$bindgen" --target web --out-dir tmp/engine-pkg "${CARGO_TARGET_DIR:-target}/wasm32-unknown-unknown/release/lkjstr_engine.wasm"
if [ "${LKJSTR_ENGINE_HARNESS:-0}" != "1" ]; then
  node scripts/engine-production-check.mjs tmp/engine-pkg
fi
