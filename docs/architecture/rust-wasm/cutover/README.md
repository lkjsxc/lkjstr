# Rust WASM Cutover

## Purpose

This subtree defines when Rust/WASM becomes the product build and when
TypeScript or Svelte product modules may be removed.

## Table of Contents

- [areas/README.md](areas/README.md): narrow area contracts for ledger rows.
- [areas/storage.md](areas/storage.md): storage cutover area.
- [areas/relay.md](areas/relay.md): relay cutover area.
- [build-contract.md](build-contract.md): app build and verification cutover.
- [deletion-ledger.md](deletion-ledger.md): TypeScript and Svelte removal guard.
- [feed-runtime.md](feed-runtime.md): shared feed runtime cutover contract.
- [implementation-ledger.md](implementation-ledger.md): dependency, owner, and next-task map.
- [parity-ledger.md](parity-ledger.md): Rust parity for each product surface.
- [relay-wiring.md](relay-wiring.md): relay host adapter and reducer wiring.
- [storage-wiring.md](storage-wiring.md): storage family wiring and deletion gates.
- [typescript-inventory.md](typescript-inventory.md): TypeScript and Svelte module classification.
- [ui-surface-map.md](ui-surface-map.md): Svelte tab to Leptos surface map.
- [verification-ledger.md](verification-ledger.md): focused and final gates by cutover area.

## Current Contract

Rust/WASM is partial and active, not design-only. The SvelteKit app remains the
implemented product runtime until the Rust shell satisfies the root workspace
contract with real behavior and matching tests.

No product mock is allowed. Synthetic relays are test-only fixtures. Use
[storage-wiring.md](storage-wiring.md), [relay-wiring.md](relay-wiring.md),
[feed-runtime.md](feed-runtime.md), [ui-surface-map.md](ui-surface-map.md),
[implementation-ledger.md](implementation-ledger.md), and
[typescript-inventory.md](typescript-inventory.md) before adding product logic to
TypeScript or Svelte.

## Migration Board

- Blocked: the TypeScript or Svelte module remains because Rust parity is not
  proven.
- Ready: Rust owns real behavior, docs, unit tests, browser tests when visible,
  and verification evidence.
- Removed: the old module was deleted in the same coherent change that recorded
  parity evidence.

## Deletion Rule

Delete a TypeScript or Svelte product module only after the Rust equivalent has:

- updated docs.
- real behavior.
- focused unit tests.
- browser tests for user-visible behavior.
- local or Docker verification evidence.
- no placeholder UI or fake protocol result.
- a row in [deletion-ledger.md](deletion-ledger.md).
