# Parity Ledger

## Purpose

This ledger tracks product surfaces that must become real Rust/WASM surfaces
before the SvelteKit product runtime can be removed.

## Status Terms

- `implemented`: Rust owns the user-visible behavior and matching tests pass.
- `partial`: Rust owns useful behavior, but product parity is incomplete.
- `not implemented`: Rust has no real product surface yet.

## Surface Ledger

| Surface         | Current Rust status | Required before deletion                                   |
| --------------- | ------------------- | ---------------------------------------------------------- |
| Home            | not implemented     | feed runtime, cache coverage, relay reads, UI tests        |
| Global          | not implemented     | selected-relay reads, grouped scans, progressive snapshots |
| Profile         | not implemented     | metadata card, route reads, posts, identity links          |
| Thread          | not implemented     | root lookup, reply pages, references, exact reads          |
| Notifications   | not implemented     | mentions, reactions, reposts, zaps, older windows          |
| Search          | not implemented     | local cache search, NIP-50 routing, cancellation           |
| Custom Request  | not implemented     | raw filter parse, validation, selected relay routing       |
| Author Context  | not implemented     | nearby author posts and honest unavailable states          |
| Accounts        | partial             | local, read-only, NIP-07 signing, secret safety tests      |
| Relay Settings  | partial             | NIP-11, discovery, NIP-65 suggestions, diagnostics         |
| Stats           | partial             | storage, relay, job, compaction, memory diagnostics        |
| Settings        | partial             | flat edits plus runtime side effects                       |
| Upload Settings | partial             | NIP-96 discovery, NIP-98 auth, file upload                 |
| lkjstr Log      | not implemented     | bounded session log with redacted diagnostics              |
| Mine npub       | not implemented     | Rust mining, cancellation, bounded worker ownership        |
| Profile Edit    | not implemented     | kind `0` editing, signing, publish retry                   |
| Tweet           | partial             | local and NIP-07 signing, publish queue, media, emoji      |
| Welcome         | partial             | full links, startup fallback, browser tests                |

## Product Rule

A partial row never allows TypeScript or Svelte deletion by itself. Deletion
requires real behavior, matching tests, and an entry in
[deletion-ledger.md](deletion-ledger.md).
