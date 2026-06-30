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
  `opfs-sahpool` OPFS as the hosted primary mode. A persistent dedicated worker
  is constructed only while holding the exclusive `lkjstr.sqlite-opfs-owner`
  Web Lock; denial or missing Web Locks surfaces explicit busy or unsupported
  storage states instead of an uncoordinated writer.
- Main-thread app code must not open SQLite or OPFS directly. Product code calls
  typed repositories; repositories talk to the worker-owned storage kernel.
- Settings, workspace layout, tab snapshots, Accounts, local signing secrets,
  relay sets, Tweet drafts, event graph, tags, relay provenance, feed cursors,
  cached feed pages, tag lookup, local filter search, relay diagnostics, relay
  information, relay suggestions, author routes, route blocks, notifications,
  jobs, cache ledger summaries, cache metadata, active account selectors,
  pressure snapshots, protection snapshots, and retention deletion use the
  SQLite worker with explicit temporary memory fallback when persistent SQLite
  cannot open.
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
- Product SQLite opens through an app-wide JavaScript broker keyed by origin,
  worker URL, and database name. The JavaScript broker and Rust/WASM product
  hosts share `/lkjstr/main.sqlite3` through centralized constants; per-island
  database-name literals are rejected by source guards. Retained TypeScript
  repositories and Rust/WASM host storage borrow the same broker entry, so
  same-page callers do not request a second Web Lock or construct another
  persistent worker. Broker lookup reports `broker-missing` for a missing global
  and `broker-key-mismatch` for worker URL or database-name mismatches. Worker
  construction, browser support, owner lock, timeout, and SQLite-open failures
  keep stable problem labels instead of collapsing to `unavailable`.
  `with_sqlite_store` borrows the shared store and no longer closes the product
  database after each repository operation. The Rust broker lookup uses JS
  reflection instead of wasm-bindgen `inline_js`, so storage startup does not
  depend on untracked snippet assets. The page shell best-effort closes
  already-loaded SQLite stores on `pagehide` without lazy-loading the bridge.
- SQLite worker `open` is idempotent for the already opened database, returns
  `busy` for a different database while the owner is open, and skips schema
  statements for an already applied schema hash. Non-cancel worker commands run
  through a serialized queue and each posts exactly one response. The owner lock
  is held until the persistent worker closes. Worker construction failure and
  worker error paths release the owner lease; the registry replaces closed
  owners on later opens. Retained TypeScript startup reads close before Rust
  feed providers mount. `pagehide` closes page-local owners while hidden tabs
  keep the owner and pause live work.
- SAH pool installation is a worker-lifetime single-flight operation. Its
  `initialCapacity` is a file-slot count, currently 64 slots, not a byte value.
  Access-handle contention such as `NoModificationAllowedError` maps to
  `busy/opfs-owner-held`, terminates the failed worker, sets a bounded retry
  cooldown, can include an ephemeral `owner-*` holder id from browser-local
  coordination, and startup does not clear OPFS or call `removeVfs()` as
  automatic recovery.
- Protected records are never removed by cache cleanup: accounts, local signing
  secrets, settings, relay sets, workspace state, Tweet drafts, active tab
  snapshots, active jobs, and route blocks.
- Recoverable cache rows are removed only through cache ledger policy. Runtime
  feed windows remain bounded; durable cached events are governed by explicit
  retention and diagnostics rather than a fixed small row count.
- Storage failure must recover to a usable Welcome workspace. Persistent OPFS,
  owner busy, unsupported Web Locks, worker construction failure, SQLite-open
  failure, and temporary memory mode must be visible in Stats, Settings,
  Accounts, Relay Settings, drafts, or the workspace shell. Startup diagnostics
  probe the broker, health, accounts, active selector, relay settings, and kind
  `0` profile-header cache rows, then log each startup failure reason once.
  Protected Home and Notifications account reads distinguish selected account,
  no accounts, no selected account, selector unavailable, storage busy,
  storage blocked or unsupported, and loading states. If the Svelte page shell
  supplies a real active account while a Rust island account read is blocked,
  the island may use that pubkey and keep the storage failure as a diagnostic.
