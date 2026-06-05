# Follow Graph

## Purpose

Follow graph modules own target NIP-02 follow-list discovery, row derivation,
and author-set construction for Followees and User Timeline.

## Table of Contents

- `target-follow-list-state.ts`: state and result contracts.
- `target-follow-list-cache.ts`: typed repository cache helpers.
- `target-follow-list-read.ts`: relay group read orchestration.
- `target-follow-list-runtime.ts`: cache-first target discovery runtime.
- `target-follow-list-diagnostics.ts`: compact diagnostics helpers.
- `follow-graph-authors.ts`: author-set derivation.
- `follow-graph-bridge.ts`: optional Rust/WASM follow-list parser bridge.

## Rules

A cache miss starts relay discovery. It never proves absence. All rows and
author sets come from real kind `3` data or explicit target-only degraded mode.
