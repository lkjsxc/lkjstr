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
2. Read [../agent/work-loop.md](../agent/work-loop.md) for the change loop
   and the skill index.
3. Read [operating-rules.md](operating-rules.md) for autonomous work rules.
4. Read [current-blockers.md](current-blockers.md) to choose the next slice.
5. Read the area README and contracts linked by the blocker row.
6. Use [../operations/focused-gates.md](../operations/focused-gates.md) for
   focused checks and [../operations/verification.md](../operations/verification.md)
   for local and Docker verification.

## Slice Order

- Completed enabling slice: storage command metadata coverage for live SQLite
  worker repositories, feed cache, feed coverage, event cache, retention,
  repair, pressure inventory, and Stats projection. Preserve the task evidence;
  storage parity and deletion remain blocked.
- Completed enabling slice: relay host-runner mapping from Rust reducer effects
  to typed browser WebSocket, timer, NIP-11, diagnostic, and owner-cleanup host
  actions. Preserve the tests; relay parity and deletion remain blocked.
- Completed enabling slice: pure shared feed row view-model data with stable
  ids, explicit unavailable and diagnostic rows, and footer states. Preserve
  the tests; feed runtime parity and deletion remain blocked.
- Completed enabling slice: first Rust Home feed rendering from app-owned row
  view models, with browser proof through an injected real event row. Preserve
  the tests; Home parity and deletion remain blocked.
- Completed enabling slice: default Rust Home provider wiring from protected
  SQLite account, relay, follow-list, cached event, and feed-coverage evidence.
  Preserve the tests; exact coverage proof, live relay snapshots, Home parity,
  and deletion remain blocked.
- Completed enabling slice: first Rust Profile feed rendering, provider wiring,
  sparse-history empty proof, cached header rendering, relay header refresh,
  Followees/User Timeline/Profile Edit actions, and first Rust Followees body
  proof plus default cached Followees host proof, first Rust User Timeline
  body proof, and default cached User Timeline host proof. Preserve the tests;
  parity and deletion remain blocked.
- Completed enabling slice: first Rust Thread cached root/reply provider wiring
  plus bounded bootstrap relay reads, explicit older page reads,
  scroll-triggered and viewport-fill older requests, bounded live reply windows,
  focused-reference hydration, bounded cached parent-chain hydration, terminal
  unavailable-parent rows, continuation rows, and cleanup proof. Preserve the
  tests; Thread parity and deletion remain blocked.
- Current first incomplete slice: broader Followees/User Timeline route
  discovery and deletion proof from [current-blockers.md](current-blockers.md).

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
- [tasks/home-feed-provider-wiring.md](tasks/home-feed-provider-wiring.md):
  Home feed provider wiring.
- [tasks/profile-feed-slice.md](tasks/profile-feed-slice.md): first Profile feed
  slice.
- [tasks/profile-feed-provider-wiring.md](tasks/profile-feed-provider-wiring.md):
  Profile feed provider wiring.
- [tasks/profile-sparse-history-proof.md](tasks/profile-sparse-history-proof.md):
  Profile sparse-history empty-state proof.
- [tasks/followees-provider-wiring.md](tasks/followees-provider-wiring.md):
  Followees provider and first Rust NIP-02 row proof.
- [tasks/user-timeline-provider-wiring.md](tasks/user-timeline-provider-wiring.md):
  User Timeline provider and first Rust feed-row proof.
- [tasks/author-context-provider-wiring.md](tasks/author-context-provider-wiring.md):
  Author Context provider and first shared-feed row proof.
- [tasks/custom-request-provider-wiring.md](tasks/custom-request-provider-wiring.md):
  Custom Request parser, run planning, and host-provider wiring.
- [tasks/search-feed-provider-wiring.md](tasks/search-feed-provider-wiring.md):
  Search provider, local indexed rows, and relay snapshot merge proof.
- [tasks/thread-feed-provider-wiring.md](tasks/thread-feed-provider-wiring.md):
  Thread cached root/reply/focused-reference/parent provider wiring.
