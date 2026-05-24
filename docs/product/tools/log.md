# Log

## Purpose

The Log tool shows current-session app, relay, and job diagnostics without
editing user data.

## Behavior

- The log renders a single chronological stream.
- Rows wrap long messages, relay URLs, event ids, job ids, and JSON context.
- Relay diagnostics may be throttled in the app log when the same message
  repeats quickly.
- Relay snapshots and diagnostic summaries remain the source for raw relay
  counters.
- The tool does not create relay subscriptions, mutate relay settings, clear
  IndexedDB data, or retry failed jobs.
- Closing the tab releases only UI-owned timers and DOM state.

## Ownership

- `src/lib/log` owns the in-memory app log.
- `src/lib/tabs/log` owns Log tab rendering.
- `src/lib/relays` owns relay diagnostic production and summary persistence.
