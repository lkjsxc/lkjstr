# Execution Tasks

## Purpose

This subtree breaks the current Rust/WASM execution queue into narrow tasks that
another agent can complete without changing product direction. Each task must be
kept aligned with current-state, the relevant architecture contract, source, and
verification ledgers in the same change.

## Table of Contents

- [storage-active-selector.md](storage-active-selector.md): route the Rust
  Accounts active-account selector through the SQLite worker and keep
  localStorage as migration-only evidence.
- [storage-command-metadata.md](storage-command-metadata.md): expand typed
  storage command metadata for live worker repository calls.
- [relay-effect-runner.md](relay-effect-runner.md): wire relay reducer effects
  to browser host actions.
- [shared-feed-view-model.md](shared-feed-view-model.md): define pure Rust feed
  row view-model data.
- [home-feed-slice.md](home-feed-slice.md): render a narrow real Home feed slice
  without parity inflation.

## Task Rule

A task is not complete until docs, implementation, focused tests, ledger status,
and actual verification evidence are updated. Do not claim parity or delete
TypeScript or Svelte product paths from a task marked partial.
