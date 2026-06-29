# Storage Modes

## Purpose

This file defines the browser storage modes that the SQLite worker may report.

## Persistent OPFS

Persistent OPFS is the normal product mode. The worker opens the app database at
`/lkjstr/main.sqlite3` through official SQLite WASM and records the selected VFS
name in storage health.

Preferred VFS order:

1. `opfs-sahpool`, because it avoids cross-origin isolation headers, fits a
   single storage owner, and is the current Cloudflare-hosted primary mode.
2. `opfs-wl`, only after platform support and media rendering are verified.
3. `opfs`, only behind an explicit mode switch when cross-origin isolation is
   safe for the current deployment.

The worker should reserve enough SAH pool file slots for the main database,
journal files, metadata, and temporary query work. SQLite SAH pool
`initialCapacity` is a file-slot count, not bytes; the initial target is 64
slots. The worker installs the SAH pool once per worker lifetime through a
single-flight promise and reuses the pool for later opens. A persistent
dedicated worker is created only after the main runtime acquires the exclusive
`lkjstr.sqlite-opfs-owner` Web Lock for that worker lifetime. App hosting should
not set COOP/COEP only for storage while `opfs-sahpool` is the normal path.
Standard OPFS VFS modes that require `SharedArrayBuffer` are not the hosted
default.

## Temporary Memory

Temporary memory mode opens `:memory:` after a non-owner persistent failure when
the caller explicitly allows transient storage or when a test explicitly forces
it. Owner collisions do not silently fall back to memory for protected records.
It keeps the workspace usable but is not durable.

The UI must show:

```text
Temporary storage mode is active. Changes may disappear when this browser session ends.
```

Temporary mode is a real mode, not a hidden fallback. Settings, workspace state,
drafts, and cached events written in this mode may disappear after reload.

## No Other Durable Fallback

Do not add IndexedDB, `localStorage`, `sessionStorage`, or Cache Storage as a
new durable replacement for OPFS SQLite. Existing non-SQL paths are cutover
sources, diagnostics, or browser-owned non-database storage only.

## Health Fields

Storage health reports one of the user-visible states:

- persistent OPFS.
- temporary memory.
- unavailable.
- timeout.
- blocked.
- corrupt.
- unknown old storage.

It also reports:

- mode: `persistent-opfs` or `temporary-memory`.
- VFS name.
- worker kind.
- database name.
- SQLite library text.
- applied schema changes.
- page count, page size, and freelist count.
- event, relay receipt, and tag row counts.
- last integrity check time.
- storage owner state: active, busy, unavailable, or temporary.
- owner reason: web-lock-granted, web-lock-held, web-lock-unavailable,
  sahpool-lock-conflict, or worker-open-failed.
- retry-after milliseconds for bounded owner-collision cooldowns.
- warnings.
