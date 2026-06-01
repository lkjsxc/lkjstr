# Deletion Ledger

## Purpose

This ledger records when TypeScript and Svelte product modules may be removed.

## Deletion Guard

Removal is allowed only after the matching Rust/WASM behavior is real, tested,
documented, and free of product mocks. Do not keep aliases for removed
first-party product modules.

## Module Ledger

| Module group             | Status  | Rust replacement requirement                         | Proof before removal                   |
| ------------------------ | ------- | ---------------------------------------------------- | -------------------------------------- |
| `src/lib/accounts`       | blocked | account rows, secrets, local signing, NIP-07 signing | account unit and browser tests         |
| `src/lib/app`            | blocked | Rust app runtime owns startup, commands, cleanup     | root workspace browser tests           |
| `src/lib/author-context` | blocked | Rust Author Context runtime and UI                   | exact-read and unavailable-state tests |
| `src/lib/backend`        | blocked | Rust app composition owns shared query services      | Home query sharing and cleanup tests   |
| `src/lib/cache`          | blocked | Rust storage repositories, retention, repair         | cache pressure and Stats tests         |
| `src/lib/components`     | blocked | Leptos components cover equivalent UI behavior       | browser parity tests                   |
| `src/lib/custom-request` | blocked | Rust Custom Request parser, runner, and UI           | parse, routing, cancel tests           |
| `src/lib/emoji`          | blocked | Rust NIP-30 and NIP-51 render/publish helpers        | emoji unit and row-render tests        |
| `src/lib/events`         | blocked | Rust event repository and row view models            | repository and feed-row tests          |
| `src/lib/feed-surface`   | blocked | Rust virtual feed surface and row pipeline           | scroll, anchor, footer tests           |
| `src/lib/fp`             | blocked | Rust reducers or no replacement need                 | deletion PR proves no imports          |
| `src/lib/identity`       | blocked | Rust identity view models and NIP-05 flow            | identity rendering tests               |
| `src/lib/jobs`           | blocked | Rust protected active jobs and finished jobs         | recovery, cancel, Stats tests          |
| `src/lib/log`            | blocked | Rust bounded session log                             | redaction and browser log tests        |
| `src/lib/media`          | blocked | Rust NIP-96 and NIP-98 upload path                   | upload transport tests                 |
| `src/lib/memory`         | blocked | Rust diagnostics and bounded counters                | memory e2e tests                       |
| `src/lib/notifications`  | blocked | Rust notification runtime and UI                     | notification feed tests                |
| `src/lib/profile`        | blocked | Rust Profile runtime and UI                          | profile route and render tests         |
| `src/lib/protocol`       | blocked | Rust protocol parity plus WASM bridge tests          | protocol Rust and WASM tests           |
| `src/lib/query`          | blocked | Rust query planning and filter reducers              | feed query unit tests                  |
| `src/lib/relays`         | blocked | Rust relay client, subscriptions, budgets, adapters  | synthetic relay browser tests          |
| `src/lib/search`         | blocked | Rust local and remote search surface                 | cache and NIP-50 tests                 |
| `src/lib/settings`       | blocked | Rust settings store and runtime side effects         | settings unit and browser tests        |
| `src/lib/storage`        | blocked | typed repositories, transactions, retention, repair  | storage and pressure tests             |
| `src/lib/tabs`           | blocked | each Leptos tab surface reaches parity               | product surface browser tests          |
| `src/lib/telemetry`      | blocked | Rust diagnostics or explicit removal                 | diagnostics and no-import proof        |
| `src/lib/thread`         | blocked | Rust Thread runtime and UI                           | thread exact-read tests                |
| `src/lib/timeline`       | blocked | Rust Home and Global feed runtimes                   | timeline and route tests               |
| `src/lib/tweet`          | blocked | Rust draft, signing, upload, queue, publish jobs     | publish and draft tests                |
| `src/lib/workspace`      | blocked | Leptos workspace parity and snapshot persistence     | workspace browser tests                |
| `src/routes`             | blocked | root route is served by the Rust/WASM app build      | app build and root smoke tests         |

## Evidence

When a row becomes removable, update the row with the Rust files, tests, and
verification commands that proved parity, then delete the TypeScript or Svelte
files in the same coherent change.
