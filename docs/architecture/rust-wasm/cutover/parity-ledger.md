# Parity Ledger

## Purpose

This ledger tracks product surfaces that must become real Rust/WASM surfaces
before the SvelteKit product runtime can be removed.

## Status Terms

- `implemented`: Rust owns the user-visible behavior and matching tests pass.
- `partial`: Rust owns useful behavior, but product parity is incomplete.
- `not implemented`: Rust has no real product surface yet.

## Surface Ledger

| Surface         | Rust status     | Required Rust modules                                         | Proof before `implemented`                                                                        |
| --------------- | --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Home            | not implemented | `app`, `relays`, `storage`, `ui` feed runtime                 | cache coverage, relay reads, shared query tests, browser feed tests                               |
| Global          | not implemented | `app`, `relays`, `storage`, `ui` feed runtime                 | selected-relay reads, grouped scans, progressive snapshots                                        |
| Profile         | not implemented | `app`, `relays`, `storage`, `ui` profile runtime              | metadata card, route reads, posts, identity links                                                 |
| Followees       | partial         | `protocol`, `app`, `web`, `relays`, `ui` follow graph path    | Leptos user rows, relay discovery UI, cleanup                                                     |
| User Timeline   | partial         | `protocol`, `app`, `web`, `relays`, `ui` target timeline path | Leptos feed surface, route discovery states, follow graph reads, degraded mode, retry diagnostics |
| Thread          | not implemented | `app`, `relays`, `storage`, `ui` thread runtime               | root lookup, reply pages, references, exact reads                                                 |
| Notifications   | not implemented | `app`, `relays`, `storage`, `ui` notification runtime         | mentions, reactions, reposts, zaps, older windows                                                 |
| Search          | not implemented | `app`, `relays`, `storage`, `ui` search runtime               | local cache search, NIP-50 routing, cancellation                                                  |
| Custom Request  | not implemented | `app`, `protocol`, `relays`, `ui` request runtime             | raw filter parse, validation, selected relay routing                                              |
| Public Chat     | partial         | `protocol`, `domain`, `app`, `relays`, `storage`, `ui`, `web` | NIP-28 parsing, channel reads, publish, partial failure, cleanup                                  |
| Author Context  | not implemented | `app`, `relays`, `storage`, `ui` context runtime              | nearby author posts, exact reads, unavailable states                                              |
| Accounts        | partial         | `domain`, `storage`, `web`, `ui` accounts path                | local, read-only, NIP-07 signing, secret safety tests                                             |
| Relay Settings  | partial         | `domain`, `storage`, `web`, `ui` relay settings path          | NIP-11, discovery, NIP-65 suggestions, diagnostics                                                |
| Stats           | partial         | `storage`, `relays`, `app`, `web`, `ui` diagnostics           | storage, relay, optimizer, job, compaction, memory diagnostics                                    |
| Settings        | partial         | `domain`, `storage`, `app`, `web`, `ui` settings path         | flat edits, appearance, retention, cache budget side effects                                      |
| Upload Settings | partial         | `domain`, `protocol`, `storage`, `web`, `ui` upload path      | Blossom endpoint display, NIP-96 discovery, upload auth, file upload                              |
| lkjstr Log      | not implemented | `app`, `storage`, `ui` bounded log path                       | redacted chronological session diagnostics                                                        |
| Mine npub       | not implemented | `protocol`, `app`, `web`, `ui` mining path                    | Rust mining, cancellation, bounded worker ownership                                               |
| Profile Edit    | not implemented | `protocol`, `app`, `relays`, `ui` edit path                   | kind `0` editing, signing, publish retry                                                          |
| Tweet           | partial         | `protocol`, `storage`, `relays`, `app`, `ui` publish path     | local and NIP-07 signing, publish queue, media, emoji                                             |
| Welcome         | partial         | `domain`, `app`, `storage`, `ui` startup path                 | full links, startup fallback, browser tests                                                       |

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
height-reservation reducer, and WASM bridge exist with focused tests. The
shipped Svelte feed uses temporary matching host glue for content-aware
estimates, unload-preserved active reservations, and long-content fragments.
SQLite observation persistence, deeper Stats projection, Leptos feed use, and
browser scroll regression proof remain open.

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
pure discovery planning, target-only degraded decisions, reason codes, and
bounded retry sources; shipped Svelte wiring remains the visible surface.

## Storage Ledger

| Storage family      | Rust status     | Required Rust modules             | Proof before cutover                                            |
| ------------------- | --------------- | --------------------------------- | --------------------------------------------------------------- |
| Protected records   | partial         | `storage`, `web`, `app`, `ui`     | SQLite startup, workspace, settings, accounts, relay sets, drafts, worker tests, recovery tests |
| Event cache         | not implemented | `storage`, `web`, `app`, `relays` | event/tag/provenance tests and cache-first browser tests        |
| Feed evidence       | not implemented | `storage`, `app`, `relays`        | coverage, cursor, scan-hint, compaction invalidation            |
| Diagnostics and log | partial         | `storage`, `web`, `app`, `ui`     | Stats inventory is wired; lkjstr Log, pressure, and failure tests remain |
| Relay optimizer     | partial         | `relays`, `app`, `storage`, `web` | score, scan hint, route trust, Stats, and synthetic relay tests |

## Product Rule

A partial row never allows TypeScript or Svelte deletion by itself. Deletion
requires real behavior, matching tests, and an entry in
[deletion-ledger.md](deletion-ledger.md).
