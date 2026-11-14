# Decisions

## Purpose

Durable decisions, newest first, with the reason for each.

## 2026-11-14: Rust/WASM only, no compatibility

- The SvelteKit app and the Rust island crates were deleted rather than ported:
  the owner asked for WASM first and no backward compatibility, and the old
  runtime did not load timelines.
- Storage moved from a SQLite OPFS worker to IndexedDB used directly from
  WASM. It needs no extra JavaScript worker and no cross-origin isolation.
- The browser app is the root Cargo package because Trunk 0.21 requires a
  root package for `index.html`.
- Decisions live in `lkjstr-core` (pure, native tests); `lkjstr-web` only
  performs effects and renders.
- Source files stay at or below 250 lines and docs at or below 200, a guard
  against both monoliths and the 200-line fragmentation of the old crates.
- Protocol details stay in `lkjstr-protocol`; a separate `lkjstr-nips` crate
  is being built in parallel and will plug in behind `plan::Directory` and
  `relays::Scores`.
