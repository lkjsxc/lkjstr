#!/bin/sh
# Isolate lockfile resolution so the orchestrator's root Cargo.lock is untouched.
set -eu
task_crate_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_harness="$task_crate_root/target/harness"
mkdir -p "$task_harness" "$task_crate_root/target/cargo-home"
cp "$task_crate_root/Cargo.toml" "$task_harness/Cargo.toml"
printf '\n[workspace]\n' >> "$task_harness/Cargo.toml"
ln -sfn ../../src "$task_harness/src"
ln -sfn ../../tests "$task_harness/tests"
export CARGO_HOME="$task_crate_root/target/cargo-home"
export CARGO_TARGET_DIR="$task_crate_root/target/build"
export CARGO_BUILD_JOBS=4
export RUST_TEST_THREADS=4
cargo fmt --manifest-path "$task_harness/Cargo.toml" -- --check
cargo clippy --manifest-path "$task_harness/Cargo.toml" --all-targets -j 4 -- -D warnings
cargo test --manifest-path "$task_harness/Cargo.toml" -p lkjstr-nips -j 4
task_sysroot=$(rustc --print sysroot)
if [ -d "$task_sysroot/lib/rustlib/wasm32-unknown-unknown/lib" ]; then
    cargo build --manifest-path "$task_harness/Cargo.toml" -p lkjstr-nips --target wasm32-unknown-unknown -j 4
else
    printf '%s\n' 'not-tested: wasm32-unknown-unknown target is not installed'
fi
