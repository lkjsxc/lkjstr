# Agent Instructions

## Purpose

Entry point for coding agents working on lkjstr.

## What lkjstr is

A browser-only, local-first Nostr client with a tiled workspace, written in
Rust and compiled to WebAssembly (Leptos UI, built by Trunk). No server-side
accounts, relay proxy or backend.

## Read order

1. [docs/status.md](docs/status.md): what works, what does not, next steps.
2. [docs/architecture.md](docs/architecture.md): where things live.
3. [docs/workspace.md](docs/workspace.md) for UI and layout work.
4. [docs/verification.md](docs/verification.md) before finishing.

## Rules

- Decisions belong in `crates/lkjstr-core` with native tests; browser effects
  belong in `crates/lkjstr-web`. Keep JavaScript to what Trunk generates.
- Protocol parsing and signing go through `lkjstr-protocol` (or `lkjstr-nips`
  once merged), never ad hoc in the UI.
- No fake product data and no placeholder success. Loading, empty, failed and
  unsupported states say what is actually happening.
- Never log, print or export local secret keys except through the explicit
  "Back up key" action.
- Long-lived collections document their bound; relay and timer work has an
  explicit release path (wants are dropped when a view hides or unmounts).
- Source files at most 250 lines, docs at most 200; docs are ASCII English.
- Keep docs and code aligned in the same change, especially docs/status.md.
- Tests and browser checks use fresh ports and local data; never publish to
  public relays from tests.

## Verification

Quiet gates print one `ok ...` line: `pnpm check:repo`, `pnpm test:quiet`,
`pnpm rust-wasm:quiet`, `pnpm verify:quiet`. Docker Compose `verify` is the
final gate. Cap parallel jobs on shared hosts (`CARGO_BUILD_JOBS=4`).

## Commits

Small logical commits with a body explaining why, plus `Tested:` and
`Not-tested:` lines that match what was actually run.
