# Storage Cutover Area

## Purpose

This file narrows the implementation-ledger storage rows. Status: partial; it
tracks what Rust must own before TypeScript storage product repositories can be
removed.

## Ledger Rows Covered

- [Protected tool storage](../implementation-ledger.md).
- [Event cache and feed evidence](../implementation-ledger.md).
- Related Stats and lkjstr Log storage fields in
  [../implementation-ledger.md](../implementation-ledger.md).

## Contract

- Current product owner: TypeScript SQLite worker repositories plus partial Rust
  protected tool hosts.
- Desired Rust owner: `lkjstr-storage` for manifest, row codecs, repositories,
  outcomes, retention, repair, inventory, and pressure; `lkjstr-web` for worker
  messaging; `lkjstr-app` for product composition; `lkjstr-ui` for Stats and
  protected tool view models.
- Required real behavior: active-account selectors, protected rows, event rows,
  tags, relay provenance, feed cursors, feed coverage, cache ledger, optimizer
  rows, jobs, app log rows, pressure snapshots, retention dispatch, repair, and
  visible storage modes.
- Storage dependency: worker-owned SQLite with OPFS or explicit temporary memory
  mode; protected rows are never pruned.
- Relay dependency: route evidence, relay provenance, diagnostics, feed page
  coverage, and optimizer rows must be available to relay and feed runtimes.
- Browser dependency: SQLite worker messages, cancellation, deadlines, close,
  quota estimates, and old-store presence diagnostics.
- Tests required: `cargo test -p lkjstr-storage`, `cargo test -p lkjstr-web`,
  cache repository tests, event repository tests, scan-model repository tests,
  and `pnpm rust-wasm:quiet`.
- Deletion target: matching `src/lib/storage/repositories/**`,
  `src/lib/storage/sqlite-opfs/**`, and event or feed repository modules only
  after all live callers have Rust replacements and no-import proof exists.
- Current status: partial. Rust row codecs and many worker calls exist;
  active-account selector rows and pressure snapshot rows now have worker
  repository calls, typed command specs, and Rust Stats pressure projection
  from real snapshot rows. Rust Accounts product wiring now resolves active
  selectors through the SQLite worker and treats the old localStorage key as a
  migration source only. Optimizer scan-model command metadata is implemented.
  Retention planner and command metadata are implemented before worker dispatch.
  Repair, search/tag lookup, full pressure byte inventory diagnostics, and
  feed-runtime consumption remain open.
- Command metadata status: active selector, pressure, protected rows, event
  cache, feed evidence, relay diagnostics, notifications, jobs, app log,
  inventory snapshot, optimizer scan-model rows, and retention planner rows are
  implemented. Retention worker dispatch remains open. Repair and search/tag
  lookup command coverage are not implemented.
- Next task order: retention worker dispatch, repair command coverage,
  search/tag lookup storage command coverage, pressure inventory completion,
  relay effect wiring, shared feed runtime, and Home feed slice.

## Acceptance Checklist

- [x] Active-account selector rows and pressure snapshot rows have Rust codecs
  and typed worker calls.
- [x] Rust Accounts uses SQLite active selector rows with localStorage as a
  migration-only source.
- [x] Active-account selector and pressure snapshot commands have typed specs,
  stable problem kinds, row-codec links, and Stats projection metadata.
- [x] Command metadata supports statement arrays, table arrays, ledger policy,
  protection policy, and typed Stats projection.
- [x] Live protected, event cache, feed evidence, diagnostics, notifications,
  jobs, app log, pressure, and inventory worker calls have Rust command
  metadata.
- [x] Optimizer scan-model commands have Rust metadata and focused proof.
- [ ] Retention, repair, and search/tag lookup commands have full Rust metadata,
  worker wiring where applicable, and focused proof.
- [ ] Every command has input, output, statement ids when not inventory-only,
  stable problem kinds, ledger policy, protection policy, Stats projection, and
  fixture proof.
- [ ] No product code opens SQLite or OPFS outside the worker.
- [ ] Stats shows persistent, temporary memory, unavailable, timeout, blocked,
  corrupt, or unknown-old-storage states without indefinite loading.
- [x] Rust Stats projects protected bytes, prunable bytes, unknown storage,
  residual overhead, and exact stop reason from a real pressure snapshot row.
- [ ] Retention deletes only ledger-backed prunable rows and reports counts.
- [ ] Repair reports schema mismatch, corrupt rows, decode failures, incomplete
  inventory, and temporary memory fallback.
- [ ] Parity and deletion ledgers state the actual status.
