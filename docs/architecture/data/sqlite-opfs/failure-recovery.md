# Failure Recovery

## Purpose

This file defines how the SQLite storage target keeps the app usable when local
storage fails.

## Startup Recovery

Startup must always reach a usable Welcome workspace unless the browser cannot
run the app shell at all.

Storage startup order:

1. Create or reuse the storage owner for `(workerUrl, databaseName)`.
2. Open persistent OPFS SQLite in the worker.
3. Apply schema changes once for the schema hash.
4. Read storage health.
5. If persistent open fails and temporary mode is allowed, open `:memory:`.
6. If both modes fail, use only process memory for the current Welcome screen
   and log a bounded storage error.

The user must see the active storage state in Stats or Settings.

## Error Categories

Storage errors are classified as:

- `open-failed`: worker or SQLite could not open the database.
- `opfs-unavailable`: required OPFS APIs or VFS support are missing.
- `sql-error`: SQLite rejected a statement.
- `constraint-failed`: schema constraints rejected data.
- `decode-failed`: a row could not be decoded into its typed record.
- `cancelled`: caller cancelled the request or deadline owner released it.
- `busy`: another owner, OPFS access handle, writable stream, or long
  transaction blocked the database.
- `blocked`: browser policy, permission state, or security capability prevents
  persistent storage.
- `temporary-mode`: operation is valid but not durable.
- `unknown`: no narrower category matched.

Recoverable errors keep UI state bounded and visible. Protected data failures
must surface through startup, Settings, Accounts, Stats, and lkjstr Log.

## OPFS Access-Handle Contention

`NoModificationAllowedError`, `createSyncAccessHandle` contention, and failures
that mention another access handle or writable stream are busy storage states.
The app must not keep spawning workers or reopening the same database in a loop.
It should:

- keep the existing owner if it already opened the requested database.
- report `busy` when another tab or stale owner holds the persistent file.
- offer explicit temporary memory mode only when the caller allows transient
  storage and the UI can show that writes are not durable.
- preserve bounded diagnostics without logging signing secrets.

Failed cleanup such as `removeVfs()` or `removeEntry()` must not become silent
success. It stays a busy or blocked diagnostic until a real reset or owner close
is completed.

## Corruption And Reset

If integrity check or schema open reports corruption, the app must not silently
clear data. It should:

- show a storage error state.
- keep the current session usable when possible.
- offer explicit reset after confirmation.
- record the reset in diagnostics without logging signing secrets.

## Cross Tab Failure

SharedWorker is preferred because all same-origin tabs can borrow one storage
owner. If SharedWorker is unavailable and a dedicated Worker cannot acquire the
persistent owner, later tabs must show busy or explicit temporary mode rather
than open a second uncoordinated writer.

Account selection, relay sets, feed runtimes, Stats, and tool panes must treat
busy or temporary storage as distinct from real empty states. A failed read does
not mean there is no active account or no enabled relay.
