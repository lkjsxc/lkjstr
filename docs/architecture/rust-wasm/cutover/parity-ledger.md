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
| Home            | partial         | `app`, `relays`, `storage`, `ui` feed runtime                 | cache coverage, relay reads, shared query tests, browser feed tests                          |
| Global          | partial         | `app`, `relays`, `storage`, `ui` feed runtime                 | selected-relay reads, grouped scans, progressive snapshots                                   |
| Profile         | partial         | `app`, `relays`, `storage`, `ui` profile runtime              | metadata card, route reads, posts, identity links                                            |
| Followees       | partial         | `protocol`, `app`, `web`, `relays`, `ui` follow graph path    | remaining parity, no-import, and deletion proof                                              |
| User Timeline   | partial         | `protocol`, `app`, `web`, `relays`, `ui` target timeline path | no-import and deletion proof                                                                 |
| Thread          | partial         | `app`, `relays`, `storage`, `ui` thread runtime               | root lookup, reply pages, references, exact reads                                            |
| Notifications   | partial         | `app`, `relays`, `storage`, `ui` notification runtime         | mentions, reactions, reposts, zaps, older windows                                            |
| Search          | partial         | `app`, `relays`, `storage`, `ui` search runtime               | provider execution, NIP-50 merge, older pages, cancellation, snapshots, deletion proof       |
| Custom Request  | partial         | `app`, `protocol`, `relays`, `ui` request runtime             | full UI/result parity, no-import proof, deletion proof                                       |
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

| Surface         | Focused gate before `implemented`                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home            | Feed Regression, Subscription Orchestration, and `cargo test -p lkjstr-app feed`                                                                                                                   |
| Global          | Relay Paging, Feed Regression, and selected-relay read tests                                                                                                                                       |
| Profile         | Profile route, sparse scan, follow-count, and shared feed runtime tests                                                                                                                            |
| Followees       | Follow graph bridge, relay discovery, retry, and cleanup tests                                                                                                                                     |
| User Timeline   | User Timeline, follow graph, degraded mode, cleanup, and route diagnostics tests                                                                                                                   |
| Thread          | Thread exact-read, reference hydration, and shared event display tests                                                                                                                             |
| Notifications   | Notification filters, paging, windows, reference, and shared feed tests                                                                                                                            |
| Search          | browser cleanup, shipped island snapshot bridge, remaining parity, and no-import proof                                                                                                             |
| Custom Request  | Raw filter parse, exact mode, query-bound preservation, app/NIP-11 clamp, selected relay, UI result-row, partial response, relay output, snapshot restore, shipped island bridge, and cancel tests |
| Public Chat     | NIP-28 reducer, relay routing, publish, moderation, partial failure, and cleanup tests                                                                                                             |
| Author Context  | Injected rows, cache reads, relay reads, action opening, unavailable states, no-import proof, and final gate                                                                                       |
| Accounts        | Account storage, signer source, NIP-07, local secret, and redaction tests                                                                                                                          |
| Relay Settings  | Relay URL, role, NIP-11, NIP-65 suggestion, disabled exclusion, and Stats tests                                                                                                                    |
| Stats           | Storage, relay, optimizer, jobs, memory, pressure, and redaction tests                                                                                                                             |
| Settings        | Flat setting edit, persistence, side effect, and cache-budget tests                                                                                                                                |
| Upload Settings | Blossom, NIP-96, NIP-98, provider fallback, and upload job tests                                                                                                                                   |
| lkjstr Log      | Durable rows, session capture, redaction, refresh, clear, and bounds tests                                                                                                                         |
| Mine npub       | Rust mining worker, cancellation, bounded ownership, and explicit-save tests                                                                                                                       |
| Profile Edit    | Kind `0` load, edit, sign, publish, retry, and cache update tests                                                                                                                                  |
| Tweet           | Draft, local signer, NIP-07, publish queue, upload, emoji, and relay result tests                                                                                                                  |
| Welcome         | Clean startup, links, fallback, and browser smoke tests                                                                                                                                            |

## Detail Ledgers

- [parity-feed-surface.md](parity-feed-surface.md): feed surface parity requirements and current evidence.
- [parity-event-and-timeline.md](parity-event-and-timeline.md): event display and User Timeline discovery proof.
- [parity-storage-ledger.md](parity-storage-ledger.md): storage parity ledger.

## Product Rule

A partial row never allows TypeScript or Svelte deletion by itself. Deletion
requires real behavior, matching tests, and an entry in
[deletion-ledger.md](deletion-ledger.md).
