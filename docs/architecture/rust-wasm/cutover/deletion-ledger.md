# Deletion Ledger

## Purpose

This ledger records when TypeScript and Svelte product modules may be removed.

## Deletion Guard

Removal is allowed only after the matching Rust/WASM behavior is real, tested,
documented, and free of product mocks. Do not keep aliases for removed
first-party product modules.

## Module Ledger

| Module group | Removal status | Rust replacement requirement |
| --- | --- | --- |
| `src/lib/protocol` | blocked | Rust protocol parity plus WASM bridge tests |
| `src/lib/accounts` | blocked | account rows, secrets, local signing, NIP-07 signing |
| `src/lib/settings` | blocked | Rust settings store and runtime side effects |
| `src/lib/storage` | blocked | typed repositories, transactions, retention, repair |
| `src/lib/workspace` | blocked | Leptos workspace parity and snapshot persistence |
| `src/lib/relays` | blocked | Rust relay client, subscriptions, budgets, adapters |
| `src/lib/timeline` | blocked | Rust Home and Global feed runtimes |
| `src/lib/profile` | blocked | Rust Profile runtime and UI |
| `src/lib/thread` | blocked | Rust Thread runtime and UI |
| `src/lib/notifications` | blocked | Rust notification runtime and UI |
| `src/lib/search` | blocked | Rust local and remote search surface |
| `src/lib/custom-request` | blocked | Rust Custom Request parser, runner, and UI |
| `src/lib/author-context` | blocked | Rust Author Context runtime and UI |
| `src/lib/tweet` | blocked | Rust draft, signing, upload, queue, and publish jobs |
| `src/lib/media` | blocked | Rust NIP-96 and NIP-98 upload path |
| `src/lib/jobs` | blocked | Rust protected active jobs and recoverable finished jobs |
| `src/lib/tabs` | blocked | each Leptos tab surface reaches parity |
| `src/lib/components` | blocked | Leptos components cover equivalent UI behavior |
| `src/routes` | blocked | root route is served by the Rust/WASM app build |

## Evidence

When a row becomes removable, update the row with the Rust files, tests, and
verification commands that proved parity, then delete the TypeScript or Svelte
files in the same coherent change.
