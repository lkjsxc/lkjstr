# Storage Modes

## Purpose

This file defines the browser storage modes that the SQLite worker may report.

## Persistent OPFS

Persistent OPFS is the normal product mode. The worker opens the app database at
`/lkjstr/main.sqlite3` through official SQLite WASM and records the selected VFS
name in storage health.

Preferred VFS order:

1. `opfs-sahpool`, because it avoids cross-origin isolation headers and fits a
   single storage owner.
2. `opfs-wl`, only after platform support and media rendering are verified.
3. `opfs`, only when cross-origin isolation is safe for the current deployment.

The worker should reserve enough SAH pool capacity for the main database,
journal files, metadata, and temporary query work. The initial target is 64 MiB,
with diagnostics when usage approaches the pool limit. App hosting should not
set COOP/COEP only for storage while `opfs-sahpool` is the normal path.

## Temporary Memory

Temporary memory mode opens `:memory:` after persistent open fails or when a
test explicitly forces it. It keeps the workspace usable but is not durable.

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

Storage health reports:

- mode: `persistent-opfs` or `temporary-memory`.
- VFS name.
- worker kind.
- database name.
- SQLite library text.
- applied schema changes.
- page count, page size, and freelist count.
- event, relay receipt, and tag row counts.
- last integrity check time.
- warnings.
