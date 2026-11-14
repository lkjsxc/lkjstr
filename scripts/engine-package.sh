#!/bin/sh
# No HTML, Trunk, deployment or external cache writes.
set -eu
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_BUILD_JOBS=4
export LKJSTR_ENGINE_HARNESS=0
export CARGO_HOME="${CARGO_HOME:-$PWD/tmp/cargo-home}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$PWD/tmp/cache}"
export TMPDIR="$PWD/tmp/temp"
mkdir -p "$TMPDIR"
sh scripts/engine-build.sh > tmp/engine-package.log 2>&1 || { tail -40 tmp/engine-package.log; exit 1; }
mkdir -p tmp/engine-dist
cp tmp/engine-pkg/lkjstr_engine.js tmp/engine-pkg/lkjstr_engine_bg.wasm engine/worker.js engine/shared.js engine/transport.js tmp/engine-dist/
wc -c tmp/engine-dist/*
