# Log

## Purpose

The Log tool shows current-session app, relay, and job diagnostics without
editing user data.

## Behavior

- The log renders a single chronological stream.
- Rows wrap long messages, relay URLs, event ids, job ids, and JSON context.
- App log rows are redacted before persistence and are stored in `app_log` when
  SQLite storage is available; session memory remains visible when storage is
  unavailable.
- Relay diagnostics may be throttled in the app log when the same message
  repeats quickly.
- Relay snapshots and diagnostic summaries remain the source for raw relay
  counters.
- The Log tool owns relay snapshot polling while it is visible.
- The tool does not create relay subscriptions, mutate relay settings, clear
  durable data, or retry failed jobs.
- Closing the tab releases only UI-owned timers and DOM state.

## Ownership

- `src/lib/log` owns session capture, redaction, and durable append calls.
- `src/lib/storage/sqlite-opfs` owns the durable app-log repository.
- `src/lib/tabs/log` owns Log tab rendering.
- `src/lib/relays` owns relay diagnostic production and summary persistence.
