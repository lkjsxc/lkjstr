# Deletion Ledger

## Purpose

This ledger records when TypeScript and Svelte product modules may be removed.

## Deletion Guard

Removal is allowed only after the matching Rust/WASM behavior is real, tested,
documented, and free of product mocks. Do not keep aliases for removed
first-party product modules.

## Module Ledger

| Module group                 | Status      | Rust replacement requirement                                                                 | Proof before removal                                                                                                                                                         |
| ---------------------------- | ----------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/accounts`           | blocked     | account rows, secrets, local signing, NIP-07 signing                                         | account unit and browser tests                                                                                                                                               |
| `src/lib/app`                | blocked     | Rust app runtime owns startup, commands, cleanup                                             | root workspace browser tests                                                                                                                                                 |
| `src/lib/author-context`     | blocked     | Rust Author Context runtime and UI                                                           | exact-read and unavailable-state tests                                                                                                                                       |
| `src/lib/backend`            | blocked     | Rust app composition owns shared query services                                              | Home query sharing and cleanup tests                                                                                                                                         |
| `src/lib/cache`              | blocked     | Rust storage repositories, retention, repair                                                 | cache pressure and Stats tests                                                                                                                                               |
| `src/lib/components`         | blocked     | Leptos components cover equivalent UI behavior and shared event renderer parity              | browser parity, shared event rendering, repost target, and no-import tests                                                                                                   |
| `src/lib/custom-request`     | blocked     | Rust Custom Request parser, runner, and UI                                                   | parse, routing, cancel tests                                                                                                                                                 |
| `src/lib/emoji`              | blocked     | Rust NIP-30 and NIP-51 render/publish helpers                                                | emoji unit and row-render tests                                                                                                                                              |
| `src/lib/events`             | blocked     | Rust event repository, shared display planner, and row view models                           | repository, shared renderer, repost rendering, unavailable state, and feed-row tests                                                                                         |
| `src/lib/feed-surface`       | blocked     | Rust virtual feed surface, real fragmented rows, unload-stable geometry, and anchor pipeline | fragmented-row, unload height-stability, dematerialization, pane resize, anchor preservation, footer behavior, one scroll owner, long-post browser test, and no-import proof |
| `src/lib/follow-graph`       | blocked     | Rust follow graph runtime and UI bridge cover all callers                                    | route discovery, retry, degraded-mode, diagnostics, bridge, and runtime tests                                                                                                |
| `src/lib/fp`                 | blocked     | Rust reducers or no replacement need                                                         | deletion PR proves no imports                                                                                                                                                |
| `src/lib/identity`           | blocked     | Rust identity view models and NIP-05 flow                                                    | identity rendering tests                                                                                                                                                     |
| `src/lib/jobs`               | blocked     | Rust protected active jobs and finished jobs                                                 | recovery, cancel, Stats tests                                                                                                                                                |
| `src/lib/log`                | blocked     | Rust bounded session log                                                                     | durable-row Rust UI is partial; session capture, redaction, browser log tests, and no-import proof remain                                                                    |
| `src/lib/media`              | blocked     | Rust Blossom, NIP-96, and NIP-98 upload path                                                 | upload transport tests                                                                                                                                                       |
| `src/lib/memory`             | blocked     | Rust diagnostics and bounded counters                                                        | memory focused tests                                                                                                                                                         |
| `src/lib/notifications`      | blocked     | Rust notification runtime and UI                                                             | notification feed, shared reference rendering, repost notification, and unload-stability tests                                                                               |
| `src/lib/profile`            | blocked     | Rust Profile runtime and UI                                                                  | profile route and render tests                                                                                                                                               |
| `src/lib/public-chat`        | blocked     | Rust Public Chat runtime, relay planning, storage, and UI                                    | NIP-28 channel and publish tests                                                                                                                                             |
| `src/lib/protocol`           | blocked     | Rust protocol parity plus WASM bridge tests                                                  | protocol Rust and WASM tests                                                                                                                                                 |
| `src/lib/query`              | blocked     | Rust query planning and filter reducers                                                      | feed query unit tests                                                                                                                                                        |
| `src/lib/relays`             | blocked     | Rust relay client, subscriptions, budgets, adapters, optimizer                               | synthetic relay browser tests                                                                                                                                                |
| `src/lib/search`             | blocked     | Rust local and remote search surface                                                         | cache and NIP-50 tests                                                                                                                                                       |
| `src/lib/settings`           | blocked     | Rust settings store and runtime side effects                                                 | settings unit and browser tests                                                                                                                                              |
| `src/lib/storage`            | blocked     | typed repositories, transactions, retention, repair                                          | storage and pressure tests                                                                                                                                                   |
| `src/lib/tabs`               | blocked     | each Leptos tab surface reaches parity                                                       | product surface browser tests                                                                                                                                                |
| `src/lib/tabs/public-chat`   | blocked     | Leptos Public Chat reaches shipped surface parity                                            | public chat browser and Rust UI tests                                                                                                                                        |
| `src/lib/telemetry`          | blocked     | Rust diagnostics or explicit removal                                                         | diagnostics and no-import proof                                                                                                                                              |
| `src/lib/thread`             | blocked     | Rust Thread runtime and UI                                                                   | thread exact-read tests                                                                                                                                                      |
| `src/lib/timeline`           | blocked     | Rust Home and Global feed runtimes                                                           | timeline and route tests                                                                                                                                                     |
| `src/lib/tweet`              | blocked     | Rust draft, signing, upload, queue, publish jobs                                             | publish and draft tests                                                                                                                                                      |
| `src/lib/user-timeline`      | blocked     | Rust User Timeline discovery planner, runtime, and Leptos surface parity                     | selected, NIP-65, provenance, partial failure, timeout, auth, target-only degraded, retry, diagnostics, and UI tests                                                         |
| `src/lib/workspace`          | blocked     | Leptos workspace parity and snapshot persistence                                             | workspace browser tests                                                                                                                                                      |
| `src/routes`                 | blocked     | root route is served by the Rust/WASM app build                                              | app build and root smoke tests                                                                                                                                               |
| Old browser database binding | implemented | live storage families use SQLite repositories                                                | no-import proof, storage, pressure, Stats, Docker gates                                                                                                                      |
| TypeScript storage repos     | blocked     | Rust repositories and Leptos hosts cover every live table family, including optimizer rows   | repository tests, browser storage tests, startup recovery, Stats inventory and health, and no-import proof                                                                   |
| Svelte tab surfaces          | blocked     | Leptos surface parity by tab                                                                 | surface browser tests and ledgers                                                                                                                                            |
| old test helpers             | blocked     | Rust/WASM tests cover the same behavior                                                      | no-import proof and passing gates                                                                                                                                            |

## Replacement Source Map

Each blocked row needs a concrete Rust path, focused test, and no-import proof
before removal.

| Module group             | Rust replacement path                                                                            | No-import proof shape     |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| `src/lib/accounts`       | `crates/lkjstr-domain`, `lkjstr-storage/src/accounts.rs`, `lkjstr-ui/src/workspace/accounts*.rs` | `rg "\\$lib/accounts      | src/lib/accounts                                             | tabs/accounts" src tests scripts`      |
| `src/lib/app`            | `crates/lkjstr-app`, `crates/lkjstr-ui/src/app.rs`, `crates/lkjstr-web`                          | `rg "src/lib/app          | \\$lib/app" src tests scripts`                               |
| `src/lib/author-context` | `lkjstr-app` Author Context inputs and new `lkjstr-ui` surface                                   | `rg "author-context       | author_context" src tests scripts`                           |
| `src/lib/backend`        | `lkjstr-app` orchestration and feed runtime                                                      | `rg "\\$lib/backend       | src/lib/backend" src tests scripts`                          |
| `src/lib/cache`          | `lkjstr-storage` ledger and Rust retention modules                                               | `rg "\\$lib/cache         | src/lib/cache" src tests scripts`                            |
| `src/lib/components`     | Shared `lkjstr-ui` Leptos components                                                             | `rg "\\$lib/components    | src/lib/components" src tests scripts`                       |
| `src/lib/custom-request` | `lkjstr-app/src/custom_request/**` and new Leptos surface                                        | `rg "custom-request       | custom_request" src tests scripts`                           |
| `src/lib/emoji`          | `lkjstr-protocol` emoji helpers and Leptos renderer                                              | `rg "\\$lib/emoji         | src/lib/emoji" src tests scripts`                            |
| `src/lib/events`         | `lkjstr-storage/src/events.rs`, `lkjstr-app/src/events/**`, Leptos event rows                    | `rg "\\$lib/events        | src/lib/events" src tests scripts`                           |
| `src/lib/feed-surface`   | `lkjstr-app` feed geometry, fragments, LOD, and Leptos feed rows                                 | `rg "feed-surface         | feed_surface" src tests scripts`                             |
| `src/lib/follow-graph`   | `lkjstr-app/src/follow_graph/**` and Leptos Followees/User Timeline                              | `rg "follow-graph         | follow_graph" src tests scripts`                             |
| `src/lib/fp`             | Rust reducers or local factories where still needed                                              | `rg "\\$lib/fp            | src/lib/fp" src tests scripts`                               |
| `src/lib/identity`       | `lkjstr-app` identity view models and Leptos identity components                                 | `rg "\\$lib/identity      | src/lib/identity" src tests scripts`                         |
| `src/lib/jobs`           | `lkjstr-storage/src/jobs.rs` and `lkjstr-app` job runtimes                                       | `rg "\\$lib/jobs          | src/lib/jobs" src tests scripts`                             |
| `src/lib/log`            | `lkjstr-storage/src/app_log.rs` and `lkjstr-ui/src/workspace/log*.rs`                            | `rg "\\$lib/log           | src/lib/log" src tests scripts`                              |
| `src/lib/media`          | `lkjstr-protocol` upload helpers, `lkjstr-web` upload host, Leptos upload UI                     | `rg "\\$lib/media         | src/lib/media" src tests scripts`                            |
| `src/lib/memory`         | `lkjstr-app` and `lkjstr-storage` diagnostics view models                                        | `rg "\\$lib/memory        | src/lib/memory" src tests scripts`                           |
| `src/lib/notifications`  | `lkjstr-app` notification runtime and Leptos surface                                             | `rg "\\$lib/notifications | src/lib/notifications                                        | tabs/notifications" src tests scripts` |
| `src/lib/profile`        | `lkjstr-app` profile runtime and Leptos profile surface                                          | `rg "\\$lib/profile       | src/lib/profile" src tests scripts`                          |
| `src/lib/public-chat`    | `lkjstr-app/src/public_chat/**` and `lkjstr-ui/src/workspace/public_chat.rs`                     | `rg "public-chat          | public_chat" src tests scripts`                              |
| `src/lib/protocol`       | `lkjstr-protocol` plus WASM bridge exports                                                       | `rg "\\$lib/protocol      | src/lib/protocol" src tests scripts`                         |
| `src/lib/query`          | `lkjstr-app/src/query/**` and feed input builders                                                | `rg "\\$lib/query         | src/lib/query" src tests scripts`                            |
| `src/lib/relays`         | `lkjstr-relays` and `lkjstr-web/src/relay_host/**`                                               | `rg "\\$lib/relays        | src/lib/relays" src tests scripts`                           |
| `src/lib/search`         | `lkjstr-app` search planner, `lkjstr-storage` search rows, Leptos search                         | `rg "\\$lib/search        | src/lib/search" src tests scripts`                           |
| `src/lib/settings`       | `lkjstr-domain`, `lkjstr-storage/src/settings*.rs`, Leptos Settings                              | `rg "\\$lib/settings      | src/lib/settings" src tests scripts`                         |
| `src/lib/storage`        | `lkjstr-storage`, `lkjstr-web/src/sqlite_store/**`, storage worker bridge                        | `rg "\\$lib/storage       | src/lib/storage" src tests scripts` after host-glue carveout |
| `src/lib/tabs`           | `lkjstr-ui/src/workspace/**` tab surfaces                                                        | `rg "\\$lib/tabs          | src/lib/tabs" src tests scripts`                             |
| `src/lib/telemetry`      | Rust diagnostics or explicit removal                                                             | `rg "\\$lib/telemetry     | src/lib/telemetry" src tests scripts`                        |
| `src/lib/thread`         | `lkjstr-app` thread runtime and Leptos Thread                                                    | `rg "\\$lib/thread        | src/lib/thread" src tests scripts`                           |
| `src/lib/timeline`       | `lkjstr-app` shared feed runtime and Leptos Home/Global                                          | `rg "\\$lib/timeline      | src/lib/timeline" src tests scripts`                         |
| `src/lib/tweet`          | `lkjstr-app` publish jobs and Leptos Tweet                                                       | `rg "\\$lib/tweet         | src/lib/tweet" src tests scripts`                            |
| `src/lib/user-timeline`  | `lkjstr-app/src/user_timeline/**` and Leptos User Timeline                                       | `rg "user-timeline        | user_timeline" src tests scripts`                            |
| `src/lib/workspace`      | `lkjstr-domain` workspace model and Leptos shell                                                 | `rg "\\$lib/workspace     | src/lib/workspace" src tests scripts`                        |
| `src/routes`             | Rust/WASM root artifact plus SvelteKit shell only                                                | `rg "from .\*routes       | src/routes" src tests scripts` and root smoke                |

## Evidence

Current `src/lib/feed-surface` evidence is partial only: Rust geometry,
fragments, anchors, unload-stable reservations, and WASM bridge exist; shipped
Svelte uses temporary host fragments, estimates, and active reservation
preservation. Deletion remains blocked until shared event renderer parity,
repost rendering tests, User Timeline discovery tests, SQLite geometry
persistence, Stats projection, Leptos feed use, browser scroll proof, and
no-import proof exist.

Current storage deletion evidence remains blocked: Rust Stats now consumes
SQLite inventory and health, but TypeScript storage repositories still own
shipped Svelte surfaces until feed, retention, pressure, and no-import proof
exist.

When a row becomes removable, update the row with the Rust files, tests, and
verification commands that proved parity, then delete the TypeScript or Svelte
files in the same coherent change.
