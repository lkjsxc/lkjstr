#!/bin/sh
# All output lives in ignored worktree paths. No services or deployments.
set -eu
export CARGO_BUILD_JOBS=4
engine_features=""
if [ "${LKJSTR_ENGINE_HARNESS:-0}" = "1" ]; then engine_features="--features=harness"; fi
cargo build --release $engine_features -p lkjstr-engine --target wasm32-unknown-unknown
bindgen="${LKJSTR_WASM_BINDGEN:-${XDG_CACHE_HOME:-$PWD/tmp/cache}/trunk/wasm-bindgen-0.2.122/wasm-bindgen}"
"$bindgen" --target web --out-dir tmp/engine-pkg target/wasm32-unknown-unknown/release/lkjstr_engine.wasm
