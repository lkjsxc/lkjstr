# Current Blockers

## Purpose

This file is the concise dependency-ordered queue for Rust/WASM work. Detailed
blocker contracts live under [blockers/README.md](blockers/README.md).

## Dependency Order

Storage wiring enables relay proof. Relay proof enables shared feed runtime
proof. Shared feed runtime proof enables surface parity. Deletion proof happens
only after real Rust parity, focused tests, ledger evidence, and no-import
proof. Do not skip this order for visible polish.

## Queue

1. [Storage command coverage](blockers/storage-command-coverage.md): implemented enabling proof to preserve.
2. [Relay effect runner](blockers/relay-effect-runner.md): implemented host mapping proof to preserve.
3. [Shared feed runtime](blockers/shared-feed-runtime.md): current first incomplete blocker.
4. [First Home Leptos feed slice](blockers/home-leptos-feed.md): implemented enabling slice; broader parity remains open.
5. [Deletion proof](blockers/deletion-proof.md): required before any retained TypeScript or Svelte product path is removed.

## Current First Incomplete Blocker

Shared feed runtime remains the first incomplete blocker. Continue from
[blockers/shared-feed-runtime.md](blockers/shared-feed-runtime.md), then update
cutover ledgers and focused gates named by that file.
