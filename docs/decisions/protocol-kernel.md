# Protocol Kernel Boundary

## Purpose

This decision records the protocol kernel boundary.

## Decision

Nostr protocol logic lives in a protocol kernel isolated from Svelte components, storage implementations, and browser WebSocket code.

## Consequences

- Event validation and signature verification stay consistent across UI, relay pool, cache, and workers.
- Tests can exercise protocol behavior without rendering UI.
- Workers can reuse the same protocol semantics through a narrow interface.
- UI code handles display intent rather than raw protocol parsing.

## Rejected Direction

Protocol parsing in Svelte components or relay callbacks is not allowed. That would create inconsistent validation and make diagnostics harder to trust.
