# SQLite OPFS Owner Lifecycle

## Purpose

This file defines the storage owner lifecycle for the browser SQLite target.
It is the contract for avoiding OPFS access-handle contention and split app
state across Accounts, Relay Settings, feeds, Stats, and tool panes.

## Owner Key

There is one logical storage owner per browser origin, worker URL, and database
name. The product database name is `/lkjstr/main.sqlite3`.

All repository calls borrow that owner. They must not create independent worker
owners for the same key, and they must not close the product database after an
individual command.

## Open Lifecycle

1. Create or look up the owner entry by `(workerUrl, databaseName)`.
2. Acquire the exclusive `lkjstr.sqlite-opfs-owner` Web Lock before constructing
   a persistent dedicated worker.
3. If the Web Lock is unavailable or already held, do not construct the worker;
   return a stable unavailable or busy owner outcome.
4. Start one open operation for the entry after ownership is granted.
5. Share the same opened store with all repository calls for that key.
6. Treat a repeated open for the same database as idempotent and return current
   diagnostics without closing and reopening SQLite.
7. Reject a request for a different database while an owner is open unless the
   caller is an explicit reset or test owner.

Worker commands are serialized by one queue per worker. `cancel` records its
target immediately; all other commands wait their turn and post one response.

SAH pool install is a worker-lifetime single-flight operation. Its
`initialCapacity` is a file-slot count; the current target is 64 slots.

Schema application is keyed by schema hash. The owner runs a schema hash once
per logical store and returns the existing result for later calls with the same
hash.

## Close Lifecycle

Close is not a repository cleanup step. It is allowed only for:

- controlled app shutdown.
- explicit user reset after confirmation.
- test reset.
- unrecoverable owner replacement that has surfaced a storage error.

Cancel releases a caller-owned request. It does not close the shared database or
terminate the worker owner.

## Cross Tab Ownership

SharedWorker is the preferred cross-tab owner because it lets same-origin tabs
share one SQLite worker. If SharedWorker is unavailable, the dedicated Worker
fallback must hold the exclusive `lkjstr.sqlite-opfs-owner` Web Lock for the
worker lifetime. A tab that cannot acquire ownership shows `busy` or enters
explicit temporary memory mode when the caller allows it.

No tab may silently open a second persistent writer for the same OPFS database.
Web Locks unavailable is an explicit unsupported storage state, not permission
to construct an uncoordinated persistent worker.

## Storage Modes

Persistent OPFS is attempted first. Temporary memory mode is allowed only when
the request allows transient storage, persistent open failed for a non-owner
reason, and the UI exposes that writes are not durable. Busy, blocked, timeout,
unavailable, corrupt, and temporary modes remain distinct in Stats, Settings,
Accounts, Relay Settings, Tweet drafts, and app-log diagnostics.
