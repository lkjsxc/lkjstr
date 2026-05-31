# Cargo

## Purpose

Cargo configuration keeps Rust commands deterministic for the workspace.

## Table of Contents

- `config.toml`: shared Cargo build configuration.

## WASM Target

`config.toml` selects the JS-backed random source for
`wasm32-unknown-unknown`. Protocol signing can compile to WASM while native
targets keep their platform random source.

The WASM C flag keeps `secp256k1-sys` compatible with clang 18 while compiling
its bundled WASM C source.
