# Global Runtime

## Purpose

Global runtime owns unauthenticated recent-note loading from readable relays.

## Contract

- Load cached kind `1` notes from the shared repository first.
- Subscribe to live kind `1` notes with startup `since`.
- Perform one bounded initial relay page without `since`.
- Keep Global to a `180` item in-memory window.
- Load older pages through `loadOlder()` from the bottom cursor.
- Load newer pages through `loadNewer()` from the top cursor when newer
  resident chunks were pruned.
- Historical relay pages use compound `{createdAt,id}` cursors, `until` or
  `since` boundary widening, local cursor filtering, and provenance-preserving
  event rows.
- Stop loading when cached notes exist, relay notes arrive, relays reach EOSE,
  relay subscriptions close, or relays fail.
- Write relay events and relay provenance through the shared repository.
- Use enabled read relays from the selected default relay set after
  normalization, dedupe, and stable sorting.
- Do not require an active account.
- Close subscriptions when the primitive runtime key changes or the tab closes.
  Relay order alone does not recreate the runtime.
