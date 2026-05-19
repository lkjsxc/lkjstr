# Testing Ownership

## Purpose

Testing ownership maps behavior to the right test layer.

## Unit

- Workspace commands and resize math.
- Tab registry and New Tab option list.
- Settings schema and override store.
- Package scripts run `kit:sync` before lint or check tools read generated
  SvelteKit config.
- Relay set selection and disabled-relay exclusion.
- Event repository paging, tag lookup, relay provenance, memory fallback, and
  compaction.
- Subscription manager one-shot page reads, EOSE cleanup, timeout cleanup, and
  relay provenance.
- Follow-list parsing, dedupe, and self inclusion.
- Timeline no-active-account, loading-follows, no-follow-list,
  no-enabled-relay, auth-required, subscription-closed, relay-failed,
  ready-empty, ready-with-events, EOSE, and cleanup behavior.
- Relay diagnostics for `CLOSED`, `NOTICE`, `AUTH`, parse failure, and invalid
  signatures.
- Tweet draft and publish helpers.
- Thread cache and runtime behavior.
- Home, Global, Profile, Thread, and Notifications `loadOlder()` and
  `loadNewer()` behavior.
- Event list near-bottom scroll triggering.

## E2E

- Root workspace render.
- New Tab direct choices.
- Flat Settings tab.
- Tweet tab label and prerequisites.
- Relay settings affecting active Account home behavior.
- Synthetic relay diagnostics and cache-only Timeline notes.
- Synthetic relay `since`, `until`, and `limit` handling.
- Heavy-feed smoke coverage for thousands of events, large follows, bounded
  runtime counters, and app heap under `100 MB`.
- Tile resize persistence.
