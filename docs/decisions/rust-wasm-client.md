# Rust WASM Client

## Purpose

This decision records the target client implementation surface.

## Decision

lkjstr is moving to a Rust/WASM-first browser client. The app remains a static
browser workspace with no required remote app backend, no required relay proxy,
and no server account system.

## Status

Design-only. The implemented state remains documented in
[../current-state.md](../current-state.md) until Rust crates, WASM bindings,
browser UI, and tests exist.

## Consequences

- Rust owns protocol, relay orchestration, storage rules, app reducers, and UI
  state as implementation moves.
- JavaScript remains only where the browser host or external tooling requires
  it.
- TypeScript and Svelte product code is removed after equivalent Rust/WASM
  behavior exists and passes matching tests.
- Browser-owned IndexedDB, WebSocket relay reads, local signing, NIP-07 access,
  and workspace recovery stay product requirements.
- Cloudflare remains a static asset hosting target, not an app backend.

## Rejected Direction

A required hosted application service, relay proxy, server account database, or
mock protocol layer is not part of the product contract.
