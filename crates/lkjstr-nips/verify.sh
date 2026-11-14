#!/bin/sh
# Verify package behavior against the actual workspace and its locked graph.
set -eu
task_crate_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_workspace_manifest="$task_crate_root/../../Cargo.toml"
task_artifacts="$task_crate_root/../../target/nips-review"
mkdir -p "$task_artifacts/cargo-home"
export CARGO_HOME="$task_artifacts/cargo-home"
export CARGO_TARGET_DIR="$task_artifacts/build"
export CARGO_BUILD_JOBS=4
export RUST_TEST_THREADS=4
cargo metadata --manifest-path "$task_workspace_manifest" --locked --format-version 1 > /dev/null
cargo fmt --manifest-path "$task_crate_root/Cargo.toml" -- --check
cargo clippy --manifest-path "$task_workspace_manifest" --locked -p lkjstr-nips --all-targets -j 4 -- -D warnings
cargo test --manifest-path "$task_workspace_manifest" --locked -p lkjstr-nips -j 4
task_sysroot=$(rustc --print sysroot)
if [ -d "$task_sysroot/lib/rustlib/wasm32-unknown-unknown/lib" ]; then
    cargo build --manifest-path "$task_workspace_manifest" --locked -p lkjstr-nips --target wasm32-unknown-unknown -j 4
else
    printf '%s\n' 'not-tested: wasm32-unknown-unknown target is not installed'
fi
