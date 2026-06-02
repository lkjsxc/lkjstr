# Failure Recovery

## Purpose

This file defines how the SQLite storage target keeps the app usable when local
storage fails.

## Startup Recovery

Startup must always reach a usable Welcome workspace unless the browser cannot
run the app shell at all.

Storage startup order:

1. Create the storage client.
2. Open persistent OPFS SQLite in the worker.
3. Apply schema changes.
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
- `busy`: another owner or long transaction blocked the database.
- `temporary-mode`: operation is valid but not durable.
- `unknown`: no narrower category matched.

Recoverable errors keep UI state bounded and visible. Protected data failures
must surface through startup, Settings, Accounts, Stats, and lkjstr Log.

## Corruption And Reset

If integrity check or schema open reports corruption, the app must not silently
clear data. It should:

- show a storage error state.
- keep the current session usable when possible.
- offer explicit reset after confirmation.
- record the reset in diagnostics without logging signing secrets.

## Multi Tab Failure

When another tab owns storage, the app should prefer shared ownership. If that
is unavailable, later tabs must show a busy or temporary state rather than open a
second uncoordinated writer.
