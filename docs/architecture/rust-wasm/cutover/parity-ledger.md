# Parity Ledger

## Purpose

This ledger tracks product surfaces that must become real Rust/WASM surfaces
before the SvelteKit product runtime can be removed.

## Status Terms

- `implemented`: Rust owns the user-visible behavior and matching tests pass.
- `partial`: Rust owns useful behavior, but product parity is incomplete.
- `not implemented`: Rust has no real product surface yet.

## Surface Ledger

| Surface         | Rust status     | Required Rust modules                                     | Proof before `implemented`                                          |
| --------------- | --------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| Home            | not implemented | `app`, `relays`, `storage`, `ui` feed runtime             | cache coverage, relay reads, shared query tests, browser feed tests |
| Global          | not implemented | `app`, `relays`, `storage`, `ui` feed runtime             | selected-relay reads, grouped scans, progressive snapshots          |
| Profile         | not implemented | `app`, `relays`, `storage`, `ui` profile runtime          | metadata card, route reads, posts, identity links                   |
| Thread          | not implemented | `app`, `relays`, `storage`, `ui` thread runtime           | root lookup, reply pages, references, exact reads                   |
| Notifications   | not implemented | `app`, `relays`, `storage`, `ui` notification runtime     | mentions, reactions, reposts, zaps, older windows                   |
| Search          | not implemented | `app`, `relays`, `storage`, `ui` search runtime           | local cache search, NIP-50 routing, cancellation                    |
| Custom Request  | not implemented | `app`, `protocol`, `relays`, `ui` request runtime         | raw filter parse, validation, selected relay routing                |
| Author Context  | not implemented | `app`, `relays`, `storage`, `ui` context runtime          | nearby author posts, exact reads, unavailable states                |
| Accounts        | partial         | `domain`, `storage`, `web`, `ui` accounts path            | local, read-only, NIP-07 signing, secret safety tests               |
| Relay Settings  | partial         | `domain`, `storage`, `web`, `ui` relay settings path      | NIP-11, discovery, NIP-65 suggestions, diagnostics                  |
| Stats           | partial         | `storage`, `relays`, `app`, `web`, `ui` diagnostics       | storage, relay, job, compaction, memory diagnostics                 |
| Settings        | partial         | `domain`, `storage`, `app`, `web`, `ui` settings path     | flat edits, appearance, retention, cache budget side effects        |
| Upload Settings | partial         | `domain`, `protocol`, `storage`, `web`, `ui` upload path  | NIP-96 discovery, NIP-98 auth, file upload                          |
| lkjstr Log      | not implemented | `app`, `storage`, `ui` bounded log path                   | redacted chronological session diagnostics                          |
| Mine npub       | not implemented | `protocol`, `app`, `web`, `ui` mining path                | Rust mining, cancellation, bounded worker ownership                 |
| Profile Edit    | not implemented | `protocol`, `app`, `relays`, `ui` edit path               | kind `0` editing, signing, publish retry                            |
| Tweet           | partial         | `protocol`, `storage`, `relays`, `app`, `ui` publish path | local and NIP-07 signing, publish queue, media, emoji               |
| Welcome         | partial         | `domain`, `app`, `storage`, `ui` startup path             | full links, startup fallback, browser tests                         |

## Product Rule

A partial row never allows TypeScript or Svelte deletion by itself. Deletion
requires real behavior, matching tests, and an entry in
[deletion-ledger.md](deletion-ledger.md).
