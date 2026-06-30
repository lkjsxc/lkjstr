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

## Agent Start

- Current source owner: TypeScript storage repositories plus partial Rust
  worker adapters for protected rows, cache evidence, pressure, inventory,
  optimizer, and Stats.
- Desired Rust owner: `lkjstr-storage`, `lkjstr-web`, `lkjstr-app`, and
  `lkjstr-ui` along the storage-kernel boundary.
- First source edit: retention and repair product consumption through the
  storage-owned inventory readiness signal.
- Focused tests: pressure, Stats, command, retention, and repair tests in
  `lkjstr-storage`, UI Stats tests in `lkjstr-ui`, web retention or repair
  tests when adapters change, cache unit tests, and `pnpm rust-wasm:quiet`.
- Ledgers: this file, implementation ledger rows, and verification ledger when
  evidence changes; deletion ledger only after actual removals.
- Keep: `src/lib/storage/sqlite-opfs/**`, `src/lib/storage/repositories/**`,
  and shipped Svelte storage surfaces until no-import proof.

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
- Storage dependency: worker-owned SQLite with an origin-level owner lease for
  persistent OPFS or explicit temporary memory mode; protected rows are never
  pruned.
- Relay dependency: route evidence, relay provenance, diagnostics, feed page
  coverage, and optimizer rows must be available to relay and feed runtimes.
- Browser dependency: Web Locks owner lease, SQLite worker messages,
  cancellation, deadlines, close, quota estimates, and old-store presence
  diagnostics.
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
  Retention planner, command metadata, delete dispatch adapter, and
  readiness-gated Rust app product planning are implemented. Repair metadata,
  storage-owned models, worker health/outcome mapping, ledger backfill batching,
  and readiness-gated app repair reporting are implemented. Search token rows,
  tag lookup metadata, event-write token batches, local indexed query adapters,
  physical repair probes, Stats browser-storage count and byte diagnostics,
  storage-owned inventory readiness classification, explicit Rust Stats
  storage-action capability states, report-only Rust repair host action,
  explicit disabled compact action reason, origin-level owner-lock denial
  mapping, and exact broker, worker, browser, timeout, and SQLite-open startup
  reason labels are implemented; Search app planning, NIP-50 merge, mutating
  repair/compaction action adapters, and feed consumption remain open.
- Command metadata status: active selector, pressure, protected rows, event
  cache, feed evidence, relay diagnostics, notifications, jobs, app log,
  inventory snapshot, optimizer scan-model rows, retention planner rows,
  retention delete dispatch rows, repair scan/probe/backfill/report rows, and
  Search token/tag rows are implemented. Search app planning, NIP-50 merge,
  Leptos parity, and deletion proof are not implemented.
- Next task order: relay effect wiring, shared feed runtime, Home feed slice,
  Search planning, and broader storage parity proof.

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
- [x] Repair probes have worker wiring and focused proof.
- [x] Repair scan, backfill, and inventory report commands have Rust metadata,
      stable labels, conservative models, and focused storage proof.
- [x] Repair worker adapters propagate health/outcome states and batch only
      storage-approved ledger backfill rows.
- [x] Search token rows, tag lookup metadata, event-write token batch steps, and
      indexed local-query command metadata have focused storage proof.
- [x] Local Search query adapters use indexed token rows and focused web compile
      proof.
- [x] `cargo test -p lkjstr-storage commands` proves command input, output,
      statement ids when not inventory-only, stable problem kinds, ledger
      policy, protection policy, Stats projection, and fixture coverage.
- [x] `pnpm check:repo` rejects raw SQLite WASM imports and OPFS open
      primitives outside `src/lib/storage/sqlite-opfs/`.
- [x] `cargo test -p lkjstr-storage stats` and
      `cargo test -p lkjstr-ui stats` prove persistent, temporary memory,
      unavailable, timeout, blocked, corrupt, and unknown-old-storage Stats
      states without indefinite loading after provider return or timeout.
- [x] Rust Stats normalizes persistent SQLite health to available, preserves
      the raw mode detail, and resolves provider reads to an explicit timeout
      snapshot instead of indefinite loading.
- [x] Rust Stats projects protected bytes, prunable bytes, unknown storage,
      residual overhead, and exact stop reason from a real pressure snapshot row.
- [x] Rust storage classifies Stats inventory for retention readiness without
      turning count-only or unknown browser storage into cleanup evidence.
- [x] Rust app retention and repair planning consumes the readiness signal
      before deriving retention byte targets or repair inputs.
- [x] Retention dispatch deletes only ledger-backed prunable statement routes
      and reports counts in Rust adapter tests.
- [x] Repair storage models report schema mismatch, corrupt rows, decode
      failures, incomplete inventory, and temporary memory mode.
- [x] Parity and deletion ledgers state the actual partial or blocked status.
