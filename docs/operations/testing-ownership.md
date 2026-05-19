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
- Cold-cache initial relay backfill for Home, Global, Profile, and Thread.
- Compound cursor filtering for same-second older relay results.
- Media/content parsing for image, video, audio, normal links, and invalid URLs.
- Deep event tree continuation rows and same-pane Profile or Thread tab reuse.
- Identity hydration mismatch and stale async response guards.
- Latest-only profile cache writes and timeline metadata hydration.
- Profile note relay provenance fallback behavior.
- Notification context safety for malformed records without event ids.
- Inactive tab retention expiry, setting changes, tab close cleanup, and
  subscription release.

## E2E

- Root workspace render.
- New Tab direct choices.
- Flat Settings tab.
- Tweet tab label and prerequisites.
- Relay settings affecting active Account home behavior.
- Synthetic relay diagnostics and cache-only Timeline notes.
- Synthetic relay `since`, `until`, and `limit` handling.
- Synthetic relay cold-cache Home notes from historical initial pages.
- Row click Thread navigation and avatar or name Profile navigation.
- Quote/reference clicks and media sizing inside desktop and mobile panes.
- Long profile metadata preserving Notes list height.
- Inactive tab scroll retention within the configured grace period and retained
  body removal after expiry.
- Heavy-feed smoke coverage for thousands of events, large follows, bounded
  runtime counters, and app heap under `100 MB`.
- Tile resize persistence.
