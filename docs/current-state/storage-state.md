# Storage State

## Purpose

Durable storage ownership and current sqlite worker behavior.

## Details

Read next: [architecture/data/README.md](../architecture/data/README.md),
[architecture/data/storage/README.md](../architecture/data/storage/README.md), and
[architecture/data/sqlite-opfs/README.md](../architecture/data/sqlite-opfs/README.md).

- Browser-owned data includes workspace layout, tabs, settings, accounts, local
  signing secrets, drafts, notifications, relay purpose lists, relay
  information, relay summaries, jobs, feed/page records, diagnostics, route
  evidence, and cached events.
- The durable product path is official SQLite WASM in a worker, using
  `opfs-sahpool` OPFS as the hosted primary mode and explicit temporary memory
  mode when persistence cannot open.
- Main-thread app code must not open SQLite or OPFS directly. Product code calls
  typed repositories; repositories talk to the worker-owned storage kernel.
- Settings, workspace layout, tab snapshots, Accounts, local signing secrets,
  relay sets, Tweet drafts, event graph, tags, relay provenance, feed cursors,
  cached feed pages, tag lookup, local filter search, relay diagnostics, relay
  information, relay suggestions, author routes, route blocks, notifications,
  jobs, cache ledger summaries, cache metadata, active account selectors,
  pressure snapshots, protection snapshots, and retention deletion use the
  SQLite worker with memory fallback when workers are unavailable.
- The Rust Leptos startup path, protected tool hosts, and first feed hosts use
  the SQLite worker for workspace recovery, workspace persistence, Settings,
  Accounts, Relay Settings, Upload Settings, Tweet drafts, Stats inventory,
  Stats SQLite health, active account selectors, pressure snapshots, durable
  lkjstr Log rows, and cached Home, Global, Notifications, Profile, and Thread feed rows.
  The Rust IndexedDB adapter remains for host-boundary tests and narrow WASM exports.
- Physical inventory, cache summaries, retention target checks, and protection
  snapshots use SQLite paths. Repair has models, adapters, and target probes.
- Storage inventory is SQLite-first. It reads SQLite table counts, cache ledger
  summaries, browser quota estimates, localStorage, Cache Storage, and old
  IndexedDB database presence diagnostics without scanning every old row.
- Rust Stats reads SQLite health and storage mode on startup. Its provider read
  is bounded; after timeout Stats shows available, temporary memory, timeout,
  unavailable, blocked, corrupt, or unknown-old-storage states explicitly.
- Rust Stats renders pressure bytes, browser diagnostics, old IndexedDB presence,
  report-only repair, and hidden compact with an explicit missing-adapter reason.
- Rust app storage maintenance consumes the storage-owned retention readiness
  classifier before retention or repair planning, without using count-only,
  unknown, old IndexedDB, residual overhead, or unowned browser storage as
  byte-safe cleanup evidence.
- Rust storage command metadata covers active selectors, pressure, protected
  rows, cache/feed evidence, diagnostics, jobs, app log, inventory, optimizer,
  row-height observation/model rows, retention, repair, Search token/tag rows,
  storage/web local-query adapters, and worker-backed Rust Search provider,
  tab snapshot restore, cached older-page proof, and relay older-page proof.
  Broader product parity and deletion proof remain open.
- Rust storage outcomes expose stable problem-kind labels for OPFS failures,
  worker init, temporary memory fallback, repair, decode, active account
  selector, pressure snapshot decode, optimizer record decode, pressure stop
  reasons, quota, and write failure diagnostics.
- Protected records are never removed by cache cleanup: accounts, local signing
  secrets, settings, relay sets, workspace state, Tweet drafts, active tab
  snapshots, active jobs, and route blocks.
- Recoverable cache rows are removed only through cache ledger policy. Runtime
  feed windows remain bounded; durable cached events are governed by explicit
  retention and diagnostics rather than a fixed small row count.
- Storage failure must recover to a usable Welcome workspace. Persistent OPFS
  mode and temporary memory mode must be visible in Stats or Settings.
