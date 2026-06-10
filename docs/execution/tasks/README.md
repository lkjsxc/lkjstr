# Execution Tasks

## Purpose

This subtree breaks the current Rust/WASM execution queue into narrow tasks that
another agent can complete without changing product direction. Each task must be
kept aligned with current-state, the relevant architecture contract, source, and
verification ledgers in the same change.

## Table of Contents

Active queue:

- [storage-command-metadata.md](storage-command-metadata.md): expand typed
  storage command coverage with the batch-capable shape.
- [storage-feed-cache-commands.md](storage-feed-cache-commands.md): cover event
  cache, feed cursor, feed coverage, scan hints, and cached feed pages.
- [storage-retention-repair.md](storage-retention-repair.md): wire retention
  delete dispatch and repair reporting.
- [storage-stats-pressure-inventory.md](storage-stats-pressure-inventory.md):
  complete pressure, inventory, and Stats storage diagnostics.
- [storage-search-index.md](storage-search-index.md): add storage-owned search
  and tag lookup rows without advancing Search surface parity.
- [relay-effect-runner.md](relay-effect-runner.md): wire relay reducer effects
  to browser host actions.
- [shared-feed-view-model.md](shared-feed-view-model.md): define pure Rust feed
  row view-model data.
- [home-feed-slice.md](home-feed-slice.md): render a narrow real Home feed slice
  without parity inflation.

Implemented evidence:

- [storage-command-spec-shape.md](storage-command-spec-shape.md): preserve the
  batch-capable command metadata shape.
- [storage-active-selector.md](storage-active-selector.md): preserve the closed
  SQLite active-account selector proof while Accounts parity remains partial.

## Task Rule

A task is not complete until docs, implementation, focused tests, ledger status,
and actual verification evidence are updated. Task files keep the checked
Purpose, Status, Current Evidence, Next Edit, Files To Read, Files To Touch,
Focused Gate, Acceptance, and Must Not headings. Do not claim parity or delete
TypeScript or Svelte product paths from a task marked partial.
