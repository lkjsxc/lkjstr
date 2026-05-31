# Scope

## Purpose

Scope docs define what is included and excluded from the project direction.

The repository has selected a browser-first Nostr workspace product surface,
local verification, and Compose development model. The target implementation
surface is Rust/WASM where browser APIs allow it.

## Included Scope

- Repository guidance.
- Vision notes.
- Current-state documentation.
- Constraints for source, documentation, collaboration, and verification.
- Rust/WASM architecture contracts for protocol, storage, relay, app, and UI
  ownership.

## Excluded Scope

- Server-required product behavior.
- Hidden relay ownership.
- Automatic destructive data cleanup.

Product, protocol, architecture, operations, research, source, tests, and
scripts now exist and should stay aligned with `docs/README.md`.
