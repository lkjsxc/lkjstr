# lkjstr Web

## Purpose

This crate owns Rust/WASM browser exports and host adapters.

## Table of Contents

- [src/](src/): WASM exports and bridge helpers.
- [tests/](tests/): browser-bound WASM tests.

## Status

The current implementation exposes real Rust protocol functions to JavaScript
and mounts the partial Rust Leptos workspace shell. Storage, relay, feed, and
tool host adapters remain documented targets until their source and tests exist.
