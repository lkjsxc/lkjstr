# UI Surface Cutover Map

## Purpose

This map links every shipped Svelte tab or component group to the intended
Leptos component group, Rust state owner, and deletion gate.

## Current Evidence

- Shipped Svelte surfaces live under `src/lib/tabs/**`, `src/lib/components/**`,
  `src/lib/workspace/**`, and feature directories under `src/lib/**`.
- Current Leptos shell code lives under `crates/lkjstr-ui/src/workspace/**`.
- `TabBody` renders real Leptos Welcome, New Tab, Stats, Log, Accounts, Relay
  Settings, Settings, Upload Settings, Tweet draft, and partial Public Chat
  surfaces. Partial feed-family Leptos bodies include shipped Home, Global, Profile, Thread, and Notifications,
  injected and worker/relay-backed Author Context shared-feed rows, shared
  event/state row rendering, and row actions; generic Svelte workspace host glue
  mounts those Rust bodies as WASM islands.
  Other tab kinds still render pending Leptos bodies while shipped behavior
  remains Svelte.

## Surface Map

| Shipped Svelte or TS group                                                                     | Intended Leptos group                                         | Rust state owner                                                   | Deletion gate                                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `src/lib/workspace/**`, `src/lib/components/workspace/**`                                      | `workspace/shell.rs`, `pane.rs`, `state.rs`, `persistence.rs` | `lkjstr-domain`, `lkjstr-app`                                      | Root Rust shell restores, splits, resizes, drags, persists, and recovers from storage failure.   |
| `src/lib/tabs/welcome/**`                                                                      | `workspace/welcome.rs`                                        | `lkjstr-domain`, `lkjstr-app`                                      | Welcome links, clean startup focus, and fallback browser tests pass.                             |
| `src/lib/tabs/new-tab/**`                                                                      | `workspace/menu.rs`                                           | `lkjstr-domain`                                                    | Full catalog opens each Rust tab kind with active-account context.                               |
| `src/lib/tabs/accounts/**`, `src/lib/accounts/**`                                              | `workspace/accounts*.rs`                                      | `lkjstr-domain`, `lkjstr-storage`, `lkjstr-web`                    | Local, read-only, NIP-07, secret redaction, and protected-storage states pass.                   |
| `src/lib/tabs/relays/**`, `src/lib/relays/**`                                                  | `workspace/relay_settings*.rs` plus relay views               | `lkjstr-domain`, `lkjstr-relays`, `lkjstr-storage`                 | Relay validation, NIP-11, NIP-65 suggestions, disabled exclusion, and diagnostics pass.          |
| `src/lib/tabs/settings/**`, `src/lib/settings/**`                                              | `workspace/settings*.rs`                                      | `lkjstr-domain`, `lkjstr-storage`                                  | Flat key-value edits and runtime side effects are Rust-owned.                                    |
| `src/lib/tabs/upload-settings/**`, `src/lib/media/**`                                          | `workspace/upload_settings*.rs` plus upload views             | `lkjstr-protocol`, `lkjstr-storage`, `lkjstr-web`                  | Blossom, NIP-96, NIP-98, progress, retry, and compose handoff pass.                              |
| `src/lib/tabs/tweet/**`, `src/lib/tweet/**`                                                    | `workspace/tweet*.rs` plus publish views                      | `lkjstr-protocol`, `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays` | Drafts, signing, uploads, publish jobs, custom emoji, and relay results pass.                    |
| `src/lib/tabs/log/**`, `src/lib/log/**`                                                        | `workspace/log*.rs`                                           | `lkjstr-storage`, `lkjstr-app`                                     | Session capture, durable rows, redaction, refresh, clear, and bounds pass.                       |
| `src/lib/tabs/stats/**`, `src/lib/memory/**`, `src/lib/telemetry/**`                           | `workspace/stats*.rs`                                         | `lkjstr-storage`, `lkjstr-relays`, `lkjstr-app`                    | Storage, relay, optimizer, jobs, memory, pressure, and security rows are real.                   |
| `src/lib/tabs/timeline/**`, `src/lib/timeline/**`, `src/lib/feed-surface/**`                   | `workspace/feed/**` to add                                    | `lkjstr-app`, `lkjstr-relays`, `lkjstr-storage`                    | Home and Global use shared feed runtime, Leptos rows, scroll proof, and no false empty.          |
| `src/lib/tabs/profile/**`, `src/lib/profile/**`                                                | `workspace/profile/**` to add                                 | `lkjstr-app`, `lkjstr-relays`, `lkjstr-storage`                    | Metadata, posts, sparse scan, follow-count states, and identity actions pass.                    |
| `src/lib/tabs/thread/**`, `src/lib/thread/**`                                                  | `workspace/thread/**` to add                                  | `lkjstr-app`, `lkjstr-protocol`, `lkjstr-relays`                   | Root lookup, replies, ancestors, references, and unavailable states pass.                        |
| `src/lib/tabs/notifications/**`, `src/lib/notifications/**`                                    | `workspace/notifications/**` to add                           | `lkjstr-app`, `lkjstr-protocol`, `lkjstr-storage`                  | Mentions, reactions, reposts, zaps, references, older windows, and diagnostics pass.             |
| `src/lib/tabs/search/**`, `src/lib/search/**`                                                  | `workspace/search/**` to add                                  | `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`                    | Rust tokenizer, indexed local search, NIP-50 merge, cancellation, and no full scan pass.         |
| `src/lib/tabs/custom-request/**`, `src/lib/custom-request/**`                                  | `workspace/custom_request/**` to add                          | `lkjstr-app`, `lkjstr-protocol`, `lkjstr-relays`                   | Raw filter parse, clamping, selected relay states, cancellation, and real output pass.           |
| `src/lib/tabs/public-chat/**`, `src/lib/public-chat/**`                                        | `workspace/public_chat.rs` plus chat modules                  | `lkjstr-app`, `lkjstr-protocol`, `lkjstr-relays`                   | NIP-28 channels, messages, moderation, publish, partial failure, and cleanup pass.               |
| `src/lib/tabs/profile-edit/**`                                                                 | `workspace/profile_edit/**` to add                            | `lkjstr-protocol`, `lkjstr-app`, `lkjstr-relays`                   | Kind `0` load, edit, sign, publish, retry, and real cache update pass.                           |
| Author Context host glue and event-row glue                                                    | `workspace/author_context*.rs`                                | `lkjstr-app`, `lkjstr-web`, `lkjstr-relays`, `lkjstr-storage`      | Generic host, event-row no-import proof, and final gate pass.                                    |
| Followees host glue and `src/lib/follow-graph/**`                                              | `workspace/followees/**` to add                               | `lkjstr-protocol`, `lkjstr-app`, `lkjstr-relays`                   | Real kind `3`, relay discovery, retry, degraded states, and cleanup pass.                        |
| User Timeline host glue, `src/lib/user-timeline/**`                                            | `workspace/user_timeline/**` to add                           | `lkjstr-app`, `lkjstr-relays`, `lkjstr-storage`                    | Cache hit, discovery, selected/NIP-65/provenance routes, target-only degraded mode, and UI pass. |
| `src/lib/tabs/npub-miner/**`, `src/lib/accounts/npub-miner*`                                   | `workspace/mine_npub/**` to add                               | `lkjstr-protocol`, `lkjstr-app`, `lkjstr-web`                      | Bounded worker ownership, cancellation, explicit save, and memory tests pass.                    |
| `src/lib/components/events/**`, `src/lib/events/**`, `src/lib/identity/**`, `src/lib/emoji/**` | Shared Leptos event, identity, and emoji components to add    | `lkjstr-protocol`, `lkjstr-app`                                    | Event renderer, repost target, reference unavailable, media, custom emoji, and actions pass.     |

## Deletion Gate

For each row, update [parity-ledger.md](parity-ledger.md) and
[deletion-ledger.md](deletion-ledger.md), run the focused gate from
[../../../operations/focused-gates.md](../../../operations/focused-gates.md),
run a no-import `rg` command for the deleted path, then remove the Svelte or
TypeScript files in the same coherent change.

## Must Not Clauses

- No fake data.
- No placeholder success.
- No direct browser database access from product code.
- No unbounded arrays.
- No hidden global state.
- No deletion before parity proof.
- No status claim without source/test evidence.
