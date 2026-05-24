# Global Runtime

## Purpose

Global runtime owns unauthenticated recent-note loading from readable relays.

## Contract

- Load cached kind `1` notes from the shared repository first.
- Subscribe to live kind `1` notes with startup `since`.
- Perform one adaptive bounded initial relay scan with `since` and `until`.
- Keep Global to a `180` item in-memory window.
- Retain at most `180` live and cached Global rows even if relays stream more.
- Load older pages through `loadOlder()` from the bottom cursor.
- Load newer pages through `loadNewer()` from the top cursor when newer
  resident chunks were pruned. Newer pages read both cache and relays.
- Initial and historical relay pages use compound `{createdAt,id}` cursors,
  adaptive `since`/`until` windows, local cursor filtering, and
  provenance-preserving event rows. Newer catch-up scans read newest bounded
  windows first and only EOSE-complete detailed statuses prove exhaustion.
- Global remains selected-relay based. It uses private safe scan cursors and
  coverage diagnostics, but it does not add author route expansion.
- Do not show terminal history state while the selected-relay scan is
  incomplete.
- Stop loading when cached notes exist, relay notes arrive, relays reach EOSE,
  relay subscriptions close, or relays fail.
- Write relay events and relay provenance through the shared repository.
- Use enabled read relays from the selected default relay set after
  normalization, dedupe, and stable sorting.
- Do not require an active account.
- Close subscriptions when the primitive runtime key changes or the tab closes.
  Relay order alone does not recreate the runtime.
