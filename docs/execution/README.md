# Execution

## Purpose

This subtree routes autonomous agents from the current product contract to the
next executable Rust/WASM slice. Status: implemented as a planning map; it does
not replace the product, architecture, or operations contracts it links.

## Mission

Move product meaning into Rust in dependency order while the shipped SvelteKit
runtime remains intact until real parity, focused tests, ledger evidence, and
no-import proof allow removal.

## Read Order

1. Start with [../current-state.md](../current-state.md).
2. Read [agent-route.md](agent-route.md) for the shortest executable route.
3. Read [operating-rules.md](operating-rules.md) for autonomous work rules.
4. Read [current-blockers.md](current-blockers.md) to choose the next slice.
5. Read the area README and contracts linked by the blocker row.
6. Use [../operations/focused-gates.md](../operations/focused-gates.md) for
   focused checks and [../operations/verification.md](../operations/verification.md)
   for local and Docker verification.

## Slice Order

- Current first slice: storage command metadata coverage for remaining live
  SQLite worker repositories, then feed cache, feed coverage, event cache,
  retention, repair, full pressure inventory, and Stats projection. The
  batch-capable command shape, active-account selector proof, and retention
  planner metadata are implemented and retained in task evidence files.
- Second slice: relay runtime wiring from Rust reducers to browser WebSocket,
  timer, and NIP-11 host effects.
- Third slice: shared feed runtime that consumes strict cache proof and
  progressive relay snapshots before any individual feed surface is removed.

## Canonical Links

- Current state: [../current-state.md](../current-state.md).
- Rust/WASM status: [../architecture/rust-wasm/status.md](../architecture/rust-wasm/status.md).
- Surface cutover order: [../architecture/rust-wasm/surface-cutover-order.md](../architecture/rust-wasm/surface-cutover-order.md).
- Implementation ledger: [../architecture/rust-wasm/cutover/implementation-ledger.md](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Parity ledger: [../architecture/rust-wasm/cutover/parity-ledger.md](../architecture/rust-wasm/cutover/parity-ledger.md).
- Deletion ledger: [../architecture/rust-wasm/cutover/deletion-ledger.md](../architecture/rust-wasm/cutover/deletion-ledger.md).
- Verification ledger: [../architecture/rust-wasm/cutover/verification-ledger.md](../architecture/rust-wasm/cutover/verification-ledger.md).
- Focused gates: [../operations/focused-gates.md](../operations/focused-gates.md).

## Completion Rule

A slice is not complete until docs, implementation, focused tests, ledgers, and
final gate evidence are updated. Docker Compose may be listed only after the
images were built and the services ran from those images.

## Table of Contents

- [agent-route.md](agent-route.md): shortest read, change, proof, ledger, and
  deletion route.
- [operating-rules.md](operating-rules.md): rules for autonomous decisions,
  deletion, fake data, security states, and docs alignment.
- [current-blockers.md](current-blockers.md): dependency-ordered blocker map
  with docs, crates, source paths, tests, and proof.
- [storage-slice.md](storage-slice.md): executable storage repository wiring
  slice.
- [tasks/README.md](tasks/README.md): granular executable task files for the
  active Rust/WASM queue.
- [tasks/storage-command-spec-shape.md](tasks/storage-command-spec-shape.md):
  implemented batch-capable storage command metadata shape.
- [tasks/storage-command-metadata.md](tasks/storage-command-metadata.md): live
  storage command metadata coverage.
- [tasks/storage-feed-cache-commands.md](tasks/storage-feed-cache-commands.md):
  event and feed cache command coverage.
- [tasks/storage-retention-repair.md](tasks/storage-retention-repair.md):
  retention delete dispatch and repair reporting.
- [tasks/storage-stats-pressure-inventory.md](tasks/storage-stats-pressure-inventory.md):
  pressure inventory and Stats diagnostics.
- [tasks/storage-search-index.md](tasks/storage-search-index.md): storage-owned
  search and tag lookup rows.
- [tasks/storage-active-selector.md](tasks/storage-active-selector.md): closed
  active-account selector evidence.
- [tasks/relay-effect-runner.md](tasks/relay-effect-runner.md): relay browser
  effect runner task.
- [tasks/shared-feed-view-model.md](tasks/shared-feed-view-model.md): shared
  feed row view-model task.
- [tasks/home-feed-slice.md](tasks/home-feed-slice.md): first Home feed slice.
