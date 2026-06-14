# Parity Ledger

## Purpose

This ledger tracks product surfaces that must become real Rust/WASM surfaces
before the SvelteKit product runtime can be removed.

## Status Terms

- `implemented`: Rust owns the user-visible behavior and matching tests pass.
- `partial`: Rust owns useful behavior, but product parity is incomplete.
- `not implemented`: Rust has no real product surface yet.

## Surface Ledger

| Surface         | Rust status     | Required Rust modules                                         | Proof before `implemented`                                                                   |
| --------------- | --------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Home            | not implemented | `app`, `relays`, `storage`, `ui` feed runtime                 | cache coverage, relay reads, shared query tests, browser feed tests                          |
| Global          | not implemented | `app`, `relays`, `storage`, `ui` feed runtime                 | selected-relay reads, grouped scans, progressive snapshots                                   |
| Profile         | not implemented | `app`, `relays`, `storage`, `ui` profile runtime              | metadata card, route reads, posts, identity links                                            |
| Followees       | partial         | `protocol`, `app`, `web`, `relays`, `ui` follow graph path    | remaining parity, no-import, and deletion proof                                              |
| User Timeline   | partial         | `protocol`, `app`, `web`, `relays`, `ui` target timeline path | no-import and deletion proof                                                                 |
| Thread          | partial         | `app`, `relays`, `storage`, `ui` thread runtime               | root lookup, reply pages, references, exact reads                                            |
| Notifications   | not implemented | `app`, `relays`, `storage`, `ui` notification runtime         | mentions, reactions, reposts, zaps, older windows                                            |
| Search          | partial         | `app`, `relays`, `storage`, `ui` search runtime               | provider execution, NIP-50 merge, older pages, cancellation, snapshots, deletion proof       |
| Custom Request  | partial         | `app`, `protocol`, `relays`, `ui` request runtime             | relay result output, cancellation, no-import proof                              |
| Public Chat     | partial         | `protocol`, `domain`, `app`, `relays`, `storage`, `ui`, `web` | NIP-28 parsing, channel reads, publish, partial failure, cleanup                             |
| Author Context  | partial         | `app`, `web`, `relays`, `storage`, `ui` context runtime       | no-import proof and final deletion readiness                                                 |
| Accounts        | partial         | `domain`, `storage`, `web`, `ui` accounts path                | local, read-only, NIP-07 signing, secret safety tests                                        |
| Relay Settings  | partial         | `domain`, `storage`, `web`, `ui` relay settings path          | NIP-11, discovery, NIP-65 suggestions, diagnostics                                           |
| Stats           | partial         | `storage`, `relays`, `app`, `web`, `ui` diagnostics           | storage, relay, optimizer, job, compaction, memory diagnostics                               |
| Settings        | partial         | `domain`, `storage`, `app`, `web`, `ui` settings path         | flat edits, appearance, retention, cache budget side effects                                 |
| Upload Settings | partial         | `domain`, `protocol`, `storage`, `web`, `ui` upload path      | Blossom endpoint display, NIP-96 discovery, upload auth, file upload                         |
| lkjstr Log      | partial         | `storage`, `web`, `ui` durable log path                       | durable rows, redacted display, refresh, and clear are wired; session capture parity remains |
| Mine npub       | not implemented | `protocol`, `app`, `web`, `ui` mining path                    | Rust mining, cancellation, bounded worker ownership                                          |
| Profile Edit    | not implemented | `protocol`, `app`, `relays`, `ui` edit path                   | kind `0` editing, signing, publish retry                                                     |
| Tweet           | partial         | `protocol`, `storage`, `relays`, `app`, `ui` publish path     | local and NIP-07 signing, publish queue, media, emoji                                        |
| Welcome         | partial         | `domain`, `app`, `storage`, `ui` startup path                 | full links, startup fallback, browser tests                                                  |

## Surface Focused Gates

| Surface         | Focused gate before `implemented`                                                      |
| --------------- | -------------------------------------------------------------------------------------- |
| Home            | Feed Regression, Subscription Orchestration, and `cargo test -p lkjstr-app feed`       |
| Global          | Relay Paging, Feed Regression, and selected-relay read tests                           |
| Profile         | Profile route, sparse scan, follow-count, and shared feed runtime tests                |
| Followees       | Follow graph bridge, relay discovery, retry, and cleanup tests                         |
| User Timeline   | User Timeline, follow graph, degraded mode, cleanup, and route diagnostics tests       |
| Thread          | Thread exact-read, reference hydration, and shared event display tests                 |
| Notifications   | Notification filters, paging, windows, reference, and shared feed tests                |
| Search          | browser cleanup, no full-scan proof, remaining parity, and no-import proof             |
| Custom Request  | Raw filter parse, clamp, selected relay, planning-state UI, partial response, and cancel tests            |
| Public Chat     | NIP-28 reducer, relay routing, publish, moderation, partial failure, and cleanup tests |
| Author Context  | Injected rows, cache reads, relay reads, action opening, unavailable states, no-import proof, and final gate |
| Accounts        | Account storage, signer source, NIP-07, local secret, and redaction tests              |
| Relay Settings  | Relay URL, role, NIP-11, NIP-65 suggestion, disabled exclusion, and Stats tests        |
| Stats           | Storage, relay, optimizer, jobs, memory, pressure, and redaction tests                 |
| Settings        | Flat setting edit, persistence, side effect, and cache-budget tests                    |
| Upload Settings | Blossom, NIP-96, NIP-98, provider fallback, and upload job tests                       |
| lkjstr Log      | Durable rows, session capture, redaction, refresh, clear, and bounds tests             |
| Mine npub       | Rust mining worker, cancellation, bounded ownership, and explicit-save tests           |
| Profile Edit    | Kind `0` load, edit, sign, publish, retry, and cache update tests                      |
| Tweet           | Draft, local signer, NIP-07, publish queue, upload, emoji, and relay result tests      |
| Welcome         | Clean startup, links, fallback, and browser smoke tests                                |

## Feed Surface Parity Requirements

Feed-like surfaces cannot be marked `implemented` until this shared proof exists:

| Requirement                 | Proof before feed-surface parity                                       |
| --------------------------- | ---------------------------------------------------------------------- |
| Rust row-fragment planner   | oversized text, media, reference, and action tests                     |
| Rust geometry estimator     | feature, bucket, hash, and confidence tests                            |
| Rust anchor reducer         | height delta, live insert, resize, and fallback tests                  |
| Stable height after unload  | event, profile, notification, repost target, shell, and LOD tests      |
| Anchor after dematerialize  | unload-preserved height and allowed shrink compensation tests          |
| Pane resize remeasurement   | width-bucket change can shrink or grow with anchor preservation        |
| WASM bridge tests           | serialization and explicit unavailable/error states                    |
| Svelte temporary bridge use | shipped feeds consume the same model while Svelte remains runtime      |
| Leptos feed surface use     | visible rows, footer rows, and scroll retention match product behavior |
| Scroll regression tests     | tall text, long token, hydration, media, resize, and overflow coverage |
| Deletion-ledger update      | `src/lib/feed-surface` row records files, tests, and no-import proof   |

Current feed-surface evidence: Rust planner, estimator, anchor reducer,
height-reservation reducer, row view model, first Home row rendering, and WASM
bridge exist with focused tests. Rust Home, Global, Notifications, and Profile
tabs can load host-owned SQLite cache evidence into shared feed rows, keep exact
coverage proof explicit, start bounded relay reads where converted, and suppress
late completions after cleanup. Global also proves footer/scroll and
viewport-fill older requests plus compound older relay cursor filtering.
Profile also proves cached and relay-refreshed
metadata/follow-count header rendering, the Followees/User Timeline/Profile
Edit actions, local/NIP-07 follow publish, and sparse empty coverage rules.
Rust Followees now has first Leptos rows from real NIP-02 entries injected
through a provider, and the default browser provider reads cached kind `3` rows
from worker SQLite, starts selected-relay or stored author-route kind `3`
discovery on cache miss, excludes disabled stored route relays, and closes the
owner relay read on cleanup; no-event selected reads render retry diagnostics,
and the shipped Svelte tab mounts the Rust body as a WASM island with row
actions.
Rust User Timeline
has first Leptos feed rows from a real NIP-02 author set injected through a
provider and a default browser provider that reads cached kind `3` author sets
plus display rows as partial cache evidence, starts selected-relay kind `3`
discovery on cache miss, and keeps explicit target-posts-only degraded mode;
stored NIP-65/provenance/target author routes can discover kind `3` without
selected relays, disabled stored route relays stay excluded, no-event selected
AUTH/rate-limited/timeout reads render explicit diagnostics, partial route
failure stays diagnostic, and owner cleanup closes the relay read. Coverage
and deletion proof remain open. The shipped Svelte User Timeline tab now mounts
the Rust body as a WASM island, forwards profile, thread, and Author Context
actions, and releases the island on visibility changes or destruction.
Rust Author Context now has a first Leptos body that renders real shared-feed
rows supplied through an injected `AuthorContextFeedProvider`. The app view
model exposes anchor and nearby query-demand inputs, and missing event id,
missing author pubkey, no route/relay input, and missing anchor timestamp
produce explicit unavailable or partial rows. The default browser provider reads
cached anchor and nearby author event rows from worker SQLite and renders them
as partial cache evidence. Bounded selected-relay reads around the cached
anchor, exact anchor lookup through stored author routes, and row action
buttons are wired, the shipped Svelte tab mounts the Rust body as a WASM
island, and browser proof covers explicit unavailable states plus island
mount/unmount. No-import proof and deletion proof remain open.
Rust Thread now loads cached focused/root events, cached replies by `#e` root
or focused-event tags, bounded cached parent-chain rows by exact id, bounded
bootstrap relay snapshots, explicit older footer-command page reads,
downward-scroll older requests, and underfilled viewport older requests into
`ThreadFeedView` rows. Bootstrap completion starts a bounded live reply window
from the newest retained row. Terminal parent misses render unavailable-parent
rows, capped branches render continuation rows, and Thread stays partial until
broader parity and deletion proof are converted.
Broader Rust feed runtime tests prove owner release removes live demand, closes
wire traffic, and keeps bounded
windows for Home, Global, Profile, and Notifications. The shipped Svelte feed
uses temporary matching host glue for content-aware estimates,
unload-preserved active reservations, and long-content fragments. SQLite
observation persistence, deeper Stats projection, remaining feed host wiring,
deletion proof, and broader browser scroll regression proof remain open.

## Event Display Proof

Shared event display parity requires Rust proof for normal event and repost
target planning, shared geometry-feature extraction, compact unavailable states,
custom emoji, media, references, sensitive-content policy, actions, and
notification repost rows. Current Rust proof covers shared/repost renderer
selection, unavailable target planning, and chrome policy. Repost-specific code
may provide contextual chrome but must not fork target event rendering without a
documented tested reason.

## User Timeline Discovery Proof

User Timeline parity requires Rust proof for cache-hit rendering, cache-miss
relay discovery, selected-relay success, NIP-65 route success, provenance-route
success, disabled-relay exclusion, partial relay failure, all-route timeout,
auth-required diagnostics, honest target-posts-only degraded mode, bounded retry
expansion, and incomplete states with reason codes. Current Rust proof covers
pure discovery planning, target-only degraded decisions, reason codes, bounded
retry sources, and a first Leptos feed body from injected real NIP-02 author-set
rows. Default cached User Timeline host proof covers worker SQLite kind `3`
author-set rows plus cached display events, keeps them partial without complete
coverage, and promotes ready state only from exact User Timeline feed, route,
relay, filter, and interval proof. Selected-relay kind `3` discovery proof
covers cache miss from the fixed `lkjsxc` New Tab path. Stored route-group proof
covers NIP-65, provenance, and target-route kind `3` discovery without selected
relays and excludes disabled stored route relays. Retry/auth/rate-limit/timeout
proof covers no-event selected-relay completion without claiming absence, AUTH
auth-required status, rate-limited selected-relay status, and all-route timeout
diagnostics. Route proof covers partial NIP-65 failure while another stored
route discovers the real kind `3`. Cleanup proof covers closing the
selected-relay read and suppressing late events. The surface stays partial until
no-import and deletion proof exist.

## Storage Ledger

| Storage family      | Rust status | Required Rust modules             | Proof before cutover                                                                                                                                        |
| ------------------- | ----------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protected records   | partial     | `storage`, `web`, `app`, `ui`     | SQLite startup, workspace, settings, accounts, active selector proof, relay sets, drafts, worker tests                                                      |
| Event cache         | partial     | `storage`, `web`, `app`, `relays` | Rust event/tag/provenance row tests pass; validation, query breadth, retention, and feed proof remain                                                       |
| Feed evidence       | partial     | `storage`, `app`, `relays`        | Rust coverage/cursor row tests pass; complete route-group proof and compaction invalidation remain                                                          |
| Diagnostics and log | partial     | `storage`, `web`, `app`, `ui`     | Storage inventory, SQLite health, pressure rows, readiness classification, and command metadata have proof; relay, jobs, memory, and full log parity remain |
| Relay optimizer     | partial     | `relays`, `app`, `storage`, `web` | score, scan hint, route trust, host-runner, Stats, and synthetic relay tests                                                                                |

## Product Rule

A partial row never allows TypeScript or Svelte deletion by itself. Deletion
requires real behavior, matching tests, and an entry in
[deletion-ledger.md](deletion-ledger.md).
