# Thread Runtime

## Purpose

Thread runtime owns event root and reply loading.

## Contract

- `ThreadRuntime` receives an event id, selected fallback relay list, and
  subscription id.
- It loads cached root and referencing events first.
- It subscribes with `ids` for the root and `#e` for replies.
- It stores incoming events in the shared event cache.
- It keeps a `240` item thread window.
- Retain at most `240` live and cached Thread rows even if relays stream more.
- It exposes `loadOlder()` and `loadNewer()`.
- Shared event lists show a loading row while `loadingOlder && hasOlder`, and
  terminal history only when `hasOlder === false`.
- State exposes `loadingOlder`, `hasOlder`, `loadingNewer`, `hasNewer`,
  `oldestCursor`, and `newestCursor`.
- Historical reads use the `e` tag index and one-shot routed relay pages sorted
  by `{created_at,id}` with relay provenance merged across duplicate replies.
- Older-window pruning sets `hasNewer`; `loadNewer()` restores newer cached or
  relay replies from the top cursor.
- It closes subscriptions on tab close.
