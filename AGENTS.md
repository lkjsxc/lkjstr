# Agent Instructions

## Purpose

Entry point for coding agents working on lkjstr.

## What lkjstr is

A browser-only, local-first Nostr client with a tiled workspace. No
server-side accounts, relay proxy or backend. Two parts:

- **Frontend** in `web/`: TypeScript with no framework, built like ytenrich.
  It draws and nothing else. build:real packages the real Worker engine.
- **Engine** in `crates/`: Rust compiled to WebAssembly, running in a Worker.
  It owns relays, the event store, parsing, signing and publishing.

The Worker lives in crates/lkjstr-engine-worker. There is one interface in
web/; no root application package, Leptos UI or Trunk build remains.

## Read order

Frontend work:

1. [docs/frontend.md](docs/frontend.md): structure of `web/`, the engine
   boundary, commands.
2. [docs/design.md](docs/design.md): the look and the interaction rules.
3. [docs/hosting-needs.md](docs/hosting-needs.md) when the build output or
   its headers change.

Engine work:

1. [docs/status.md](docs/status.md): what works, what does not, next steps.
2. [docs/architecture.md](docs/architecture.md): where things live.
3. [docs/verification.md](docs/verification.md) before finishing.

## Frontend rules

- Work in `web/`. The gate is `pnpm check`, then `pnpm build` and
  `pnpm smoke`; each prints one `ok ...` line.
- The main thread never parses an event, opens a socket or touches the event
  store. Everything goes through `web/src/engine/protocol.ts`, which changes
  only on the frontend side; the engine side proposes changes in
  `docs/engine-proposals.md`.
- Source files at most 300 lines, `create*` factories instead of classes, DOM
  through `h()`, no HTML strings.
- Every visible string is in both string tables; Japanese is written as
  Japanese.
- Judge visual changes with `pnpm shots`, and keep docs/design.md true.

## Engine rules

- Decisions belong in `crates/lkjstr-core` with native tests; browser effects
  belong in `crates/lkjstr-engine-worker`. JavaScript is limited to loading
  and transport glue; product policy stays in Rust.
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

Frontend: in `web/`, `pnpm check`, `pnpm build`, `pnpm smoke`.

Engine, from the repository root, quiet gates print one `ok ...` line: `pnpm check:repo`, `pnpm test:quiet`,
`pnpm rust-wasm:quiet`, `pnpm verify:quiet`. Docker Compose `verify` is the
final gate. Cap parallel jobs on shared hosts (`CARGO_BUILD_JOBS=4`).

## Commits

Small logical commits with a body explaining why, plus `Tested:` and
`Not-tested:` lines that match what was actually run.
