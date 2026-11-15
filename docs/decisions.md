# Decisions

## Purpose

Durable decisions, newest first, with the reason for each.

## 2026-11-14: Public addresses and language boundaries

- `addresses` owns validated, public paths in the core. JSON view serialization
  stays internal to persistence and feed anchors; it never enters public URLs.
- Focus changes replace browser state; navigation within a tab pushes it.
  A saved focused view resumes its history on reload. Explicit addresses add
  independent tabs to the saved desk. Unsupported addresses offer a way home.
- Search keys containing an nsec prefix are refused before relay requests or
  public workspace persistence. Signer exceptions are reduced to known messages
  so an extension cannot echo a secret in an error.
- Interface words and numbered formatting templates live in bounded core tables.
  A native source guard rejects literal view prose/accessibility text and missing
  table entries. The normal build runs that guard before producing the artifact.
- Identical neighbour details are independent too. A different detail may still
  replace a preview according to the neighbour rule; identical opens keep the
  old preview and create a fresh one.
- Physical keyboard resizing is pure core policy. Browser measurements supply
  desk dimensions; the core clamps 40px steps to subtree minima.
- The requested steward notes, review and ADR directory did not exist when this
  phase began. No external ADR records were available to import.

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

## 2026-11-15: one frontend and one Worker

- web/ is the sole TypeScript interface. The Leptos UI/runtime, root HTML
  entry and exclusive styles/browser drivers were removed.
- The Worker moved to crates/lkjstr-engine-worker. Root Cargo.toml is a virtual
  workspace; root build and release gates use the real frontend/Worker graph.
- This supersedes the root-package and Trunk choices recorded above.
