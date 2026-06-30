# SQLite OPFS App Broker

## Purpose

This file defines the app-wide broker that owns the product SQLite worker from
JavaScript host code and lends the same owner to retained TypeScript
repositories and Rust/WASM host adapters.

## Broker Key

The product broker key is `(origin, workerUrl, databaseName)`.

- `origin`: the current browser origin.
- `workerUrl`: `/sqlite-opfs-worker.js`.
- `databaseName`: `/lkjstr/main.sqlite3`.

There is at most one open broker entry for this key in a page. Same-page
callers borrow that entry; they must not request another exclusive Web Lock or
construct another persistent SQLite worker.

## Host Shape

The SvelteKit page imports the broker before product storage or Rust islands can
mount. The broker is published on `globalThis.__lkjstrSqliteOpfsBroker` with:

- `origin`, `workerUrl`, and `databaseName` key fields.
- `send(op, options)`, which routes typed worker operations through the shared
  product open path.
- `close(deadlineMs)`, which is reserved for page shutdown, reset, and tests.

The global object is a host adapter, not a product repository. Product modules
continue to call typed repositories. Rust/WASM host code discovers the broker by
JS reflection and sends the same typed worker operations through it.

## Open Rules

1. Look up the broker entry for the product key.
2. If an opened or opening entry exists, borrow its promise and worker client.
3. If no entry exists, acquire the exclusive `lkjstr.sqlite-opfs-owner` Web Lock
   before constructing the dedicated worker.
4. If ownership is denied, return a stable busy or blocked response and do not
   construct a worker.
5. Open the product database once and apply each schema hash once.
6. Keep the worker alive across repository operations until page shutdown,
   explicit reset, test reset, or unrecoverable owner replacement.

Web Locks are not reentrant. A Rust island, a Svelte repository, Stats, Accounts,
Relay Settings, Tweet drafts, or feed host in the same page must reuse the
broker entry instead of acquiring a second lease.

## Failure Rules

Owner denial, Web Lock absence, SAH-pool access-handle contention,
`NoModificationAllowedError`, and `createSyncAccessHandle` conflicts return
stable busy, blocked, or unavailable diagnostics. Failed worker opens terminate
the worker, release any partial lease, and enter a bounded cooldown before the
next owner attempt.

Owner collisions never silently fall back to temporary memory for protected
data. Automatic recovery must not call `removeVfs()`, delete OPFS files, or clear
persistent data. Another tab may retry only through bounded, user-visible retry
state.

## Close Rules

Repository operations do not close the broker. Close is allowed only for
pagehide, explicit reset after confirmation, tests, or unrecoverable worker
replacement that has already surfaced a storage error.
