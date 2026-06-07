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
- The Rust Log body reads recent durable `app_log` rows through the SQLite
  worker, redacts display text again before rendering, and reports explicit
  unavailable or timeout states when storage cannot answer.
- Manual refresh rereads durable rows. Clear deletes recoverable durable log rows
  at or before the requested clear time and then refreshes from storage.
- Relay diagnostics may be throttled in the app log when the same message
  repeats quickly.
- Relay snapshots and diagnostic summaries remain the source for raw relay
  counters.
- The Log tool owns relay snapshot polling while it is visible.
- The tool does not create relay subscriptions, mutate relay settings, or retry
  failed jobs.
- Closing the tab releases only UI-owned timers and DOM state.

## Ownership

- `src/lib/log` owns shipped session capture, redaction, and durable append
  calls while the Svelte runtime remains the visible product.
- `crates/lkjstr-storage/src/app_log.rs` owns Rust app-log row shape and display
  redaction helpers.
- `crates/lkjstr-web/src/app_log_host.rs` owns Rust SQLite worker calls for
  listing and clearing durable log rows.
- `crates/lkjstr-ui/src/workspace/log*.rs` owns the Rust Log tab rendering.
- `src/lib/storage/sqlite-opfs` owns the shipped durable app-log repository.
- `src/lib/tabs/log` owns shipped Log tab rendering until Rust reaches full
  parity.
- `src/lib/relays` owns relay diagnostic production and summary persistence.
