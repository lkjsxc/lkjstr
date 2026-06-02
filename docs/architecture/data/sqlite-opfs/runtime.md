# SQLite OPFS Runtime

## Purpose

This file defines how the browser opens and owns the SQLite WASM database.
Status: partial host implementation.

## Runtime Owner

`lkjstr-web` starts one dedicated storage worker for the active app instance.
The worker loads the official SQLite WASM assets, opens the configured database,
applies Rust-provided schema statements, executes bounded requests, returns typed
rows and diagnostics, and closes cleanly.

`lkjstr-storage` owns all SQL text and statement meaning. The worker does not
choose tables, data classes, compaction policy, feed coverage semantics, or
product recovery behavior.

The Rust `lkjstr-web` adapter owns the browser `Worker`, typed envelopes,
deadlines, cancellation, close cleanup, late diagnostics, and SQLite-backed
repository calls for protected, event-cache, and diagnostics families. Product
startup and feed runtimes still need wiring before this becomes the durable
product path.

## Static Assets

The Rust/Trunk app serves `/sqlite-opfs-worker.js` as the storage worker entry.
Trunk copies the pinned official SQLite WASM package output to `/sqlite/` so
the worker can import `/sqlite/index.mjs` and load `sqlite3.wasm` plus the OPFS
proxy script from same-origin static assets.

The current SvelteKit build also emits the same `/sqlite/` assets so the worker
path can be tested before the Rust app is the only shipped runtime.

## VFS Selection

Primary path: use SQLite WASM `opfs` in a worker when it is available.

Required hosting headers for that path:

```text
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

If those headers or browser APIs are unavailable, the worker may try the
explicit `opfs-sahpool` path. That path is allowed only with a single storage
owner coordinated by Web Locks or BroadcastChannel and visible diagnostics when
another tab owns storage.

Never silently downgrade to `localStorage`, `sessionStorage`, or in-memory
storage for product data.

## Concurrency

The app treats OPFS SQLite as a short-transaction store. Request batches are
bounded, prepared statements are reset or finalized promptly, and long scans are
split into resumable pages. A busy database returns `Busy`; callers may retry
only through bounded policy in `lkjstr-app`.

Multi-tab behavior must be explicit. The preferred state is a visible shared or
locked owner model, never two uncoordinated workers writing the same database.

## Journal Mode

Do not enable WAL by default. OPFS SQLite does not gain useful browser
concurrency from WAL, and the primary `opfs` path loses concurrency when
exclusive locking is required. Use rollback-journal transactions, short batches,
and small write groups.

## Failure Mapping

- missing worker support: `Unavailable`.
- startup failure: `Unavailable`.
- database lock or SQLite busy state: `Busy`.
- deadline expiration: `Timeout`.
- quota failure: `Quota`.
- malformed database or schema mismatch: `Corrupt`.
- explicit cancellation: `Canceled`.
- response after owner cleanup: `LateSettled` or `LateRejected`.
