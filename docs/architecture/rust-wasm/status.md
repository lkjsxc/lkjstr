# Rust WASM Status

## Purpose

This file is the concise status entry for the active Rust/WASM migration.
Detailed status lives under [status/README.md](status/README.md).

## Current State

Rust/WASM is partial and actively implemented. SvelteKit and TypeScript remain
the shipped product runtime until each Rust surface has real behavior, matching
tests, truthful states, and no-import proof for deleted TypeScript or Svelte
paths.

## Detail Map

- [status/implemented-slices.md](status/implemented-slices.md): implemented Rust slice ownership.
- [status/active-targets.md](status/active-targets.md): active target slices.
- [status/open-foundations.md](status/open-foundations.md): open foundations and runtime rule.
- [status/next-order.md](status/next-order.md): next execution order.

## Next Order

Use [surface-cutover-order.md](surface-cutover-order.md) for dependency rank,
[cutover/implementation-ledger.md](cutover/implementation-ledger.md) for owner
and dependency rows, and [cutover/verification-ledger.md](cutover/verification-ledger.md)
for checks.
