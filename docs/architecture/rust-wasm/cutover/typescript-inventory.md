# TypeScript Inventory

## Purpose

This inventory classifies shipped TypeScript and Svelte module groups so agents
can identify host glue, temporary UI, and logic that must move to Rust. Local
README files may add narrower notes for individual files; this ledger is the
cutover default.

## Classification Terms

- `host-glue`: may remain while it only mounts the app, forwards actions, or
  owns DOM and focus ceremony.
- `browser-api-adapter`: may remain behind a narrow typed boundary for APIs that
  Rust/WASM cannot call directly.
- `view-only`: may remain until Leptos parity renders the same Rust-owned view
  model.
- `domain-logic`, `protocol-logic`, `storage-logic`, `relay-logic`, and
  `feed-logic`: must move to the Rust crate named in the row.
- `deletion-target`: remove after parity, tests, and no-import proof.

## Module Group Classification

| Module group                                                                        | Current classification                 | Temporary allowance                                         | Rust owner                                                        | Cutover trigger                                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/routes`                                                                        | host-glue                              | root SvelteKit shell, layout, WASM loading                  | `lkjstr-web`, `lkjstr-ui`                                         | Rust root build serves workspace and smoke test passes                  |
| `src/lib/components/workspace`                                                      | view-only plus host-glue               | DOM layout, focus, drag, resize, scroll ownership           | `lkjstr-ui`, `lkjstr-app`                                         | Leptos workspace shell reaches pane and tab parity                      |
| `src/lib/workspace`                                                                 | domain-logic and host-glue             | shipped tab runtime and persistence until Rust shell parity | `lkjstr-domain`, `lkjstr-app`, `lkjstr-web`                       | Rust workspace reducers, snapshots, recovery, and browser tests pass    |
| `src/lib/storage/sqlite-opfs`                                                       | browser-api-adapter plus storage-logic | current worker host and official SQLite WASM glue           | `lkjstr-storage`, `lkjstr-web`                                    | Rust typed repositories cover all live table families                   |
| `src/lib/storage/repositories`                                                      | storage-logic                          | typed facade for shipped Svelte runtime only                | `lkjstr-storage`, `lkjstr-web`                                    | Rust worker commands cover matching repository methods                  |
| `src/lib/storage/retention`, `src/lib/cache`                                        | storage-logic                          | retention and pressure logic until Rust dispatchers ship    | `lkjstr-storage`, `lkjstr-app`                                    | Rust retention, repair, pressure, and Stats tests pass                  |
| `src/lib/protocol`                                                                  | protocol-logic                         | bridge for shipped TS callers only                          | `lkjstr-protocol`, `lkjstr-web`                                   | Rust parser/builders cover all callers and WASM bridge tests pass       |
| `src/lib/relays`                                                                    | relay-logic                            | shipped relay pool, orchestrator, selected-relay reads      | `lkjstr-relays`, `lkjstr-app`, `lkjstr-web`                       | WebSocket effects and subscription leases are Rust-owned in product     |
| `src/lib/timeline`, `src/lib/profile`, `src/lib/thread`                             | feed-logic                             | shipped Home, Global, Profile, Thread runtimes              | `lkjstr-app`, `lkjstr-relays`, `lkjstr-storage`, `lkjstr-ui`      | shared Rust feed runtime renders each surface                           |
| `src/lib/notifications`                                                             | feed-logic                             | account-aware notification runtime and presentation         | `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`, `lkjstr-ui`      | Rust notification view model and feed window tests pass                 |
| `src/lib/feed-surface`                                                              | feed-logic and browser-api-adapter     | DOM measurement and Svelte virtual list bridge              | `lkjstr-app`, `lkjstr-ui`, `lkjstr-web`                           | Leptos feed surface uses Rust geometry, anchors, and row planner        |
| `src/lib/events`                                                                    | protocol-logic, feed-logic, view-only  | event repositories, content rendering, action summaries     | `lkjstr-protocol`, `lkjstr-app`, `lkjstr-ui`                      | shared Rust event view model covers rows and unavailable states         |
| `src/lib/identity`, `src/lib/author-context`                                        | domain-logic and view-only             | identity cache, NIP-05 state, shipped Author Context loader | `lkjstr-app`, `lkjstr-storage`, `lkjstr-ui`, `lkjstr-web`          | Rust identity and Author Context cache/relay parity ship                |
| `src/lib/accounts`                                                                  | domain-logic and browser-api-adapter   | local secret access, NIP-07, miner worker                   | `lkjstr-domain`, `lkjstr-storage`, `lkjstr-web`, `lkjstr-ui`      | Rust account flows, redaction tests, and signer boundaries pass         |
| `src/lib/settings`                                                                  | domain-logic                           | flat settings schema and side effects                       | `lkjstr-domain`, `lkjstr-storage`, `lkjstr-app`                   | Rust settings store drives shipped surface and side effects             |
| `src/lib/tweet`, `src/lib/media`                                                    | protocol-logic and browser-api-adapter | drafts, upload fetches, compose transport                   | `lkjstr-protocol`, `lkjstr-storage`, `lkjstr-app`, `lkjstr-web`   | Rust publish jobs and upload commands own real flows                    |
| `src/lib/search`                                                                    | feed-logic and storage-logic           | shipped SQLite token index and query helpers                | `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`                   | Rust app planner, NIP-50 merge, and UI parity land                      |
| `src/lib/custom-request`                                                            | protocol-logic and relay-logic         | shipped request runner and validation display               | `lkjstr-app`, `lkjstr-protocol`, `lkjstr-relays`, `lkjstr-ui`, `lkjstr-web` | Rust planner and Leptos provider drive selected-relay planning states   |
| `src/lib/public-chat`                                                               | domain-logic and relay-logic           | shipped NIP-28 channels, messages, moderation, publish      | `lkjstr-domain`, `lkjstr-protocol`, `lkjstr-app`, `lkjstr-relays` | Rust chat reducer, storage, relay, and UI parity pass                   |
| `src/lib/jobs`, `src/lib/log`, `src/lib/telemetry`, `src/lib/memory`, `src/lib/app` | domain-logic and diagnostics           | runtime counters and diagnostic capture for shipped product | `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`, `lkjstr-ui`      | Rust diagnostics view models and redacted log capture ship              |
| `src/lib/tabs`                                                                      | view-only with embedded product logic  | shipped Svelte tab surfaces                                 | `lkjstr-ui`, lower Rust crates by surface                         | each tab reaches the parity row in [parity-ledger.md](parity-ledger.md) |
| `tests` TypeScript helpers                                                          | test-only harness                      | deterministic local fixtures cannot enter product runtime   | Rust crate tests or WASM host tests                               | no-import proof shows old helpers are no longer needed                  |

## Editing Rule

When editing a TypeScript file classified as product logic, either move behavior
toward the named Rust owner or update the relevant ledger with a precise blocker.
Do not add new product source of truth in TypeScript.
