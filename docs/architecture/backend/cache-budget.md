# Cache Budget

## Purpose

Define the enforced local site storage target and how prunable cached events
absorb storage pressure.

## Contract

- `cache.maxBytes` defaults to `67108864` bytes.
- The setting is a site storage target, not an event-count limit.
- When browser storage estimates are available, total estimated site usage is
  kept under the lower of `cache.maxBytes` and the browser quota pressure
  threshold when enough prunable event-cache data exists.
- The event-cache target is the site target minus estimated protected or
  non-event usage. If estimates are unavailable, the event-cache target is
  `cache.maxBytes`.
- Compaction preserves accounts, local signing secrets, settings, relay sets,
  workspace state, notifications, Tweet drafts, tab snapshots, relay
  configuration, latest metadata needed by cached pubkeys, active-account
  follow lists, runtime pins, notification-critical events, and explicit
  `forceProtected` rows.
- Compaction stops cleanly when event-cache bytes are under the effective
  event-cache target or no prunable event candidates remain.
- If protected or non-event usage alone exceeds the target, report
  `protected-or-non-cache-usage` and do not delete protected records.

## Algorithm

1. Load `cache.maxBytes`; if absent, use `67108864`.
2. Read app-owned event-cache byte accounting from indexed priority rows.
3. Read `navigator.storage.estimate()` when supported.
4. Compute the site target as `cache.maxBytes`, clamped by quota pressure when
   a browser quota estimate exists.
5. Estimate protected or non-event usage as `browserUsage - eventCacheBytes`
   when browser usage is known.
6. Compute the effective event-cache target as
   `max(0, siteTarget - protectedOrNonEventUsage)`.
7. Compact score-ordered prunable events until event-cache bytes are under the
   effective target or no candidates remain.
8. Record the result in `cacheMeta`: site budget bytes, effective event-cache
   target bytes, estimated event-cache bytes, browser usage bytes, pruned rows,
   pruned byte estimate, skipped reason, and whether only protected rows
   remain.

## Triggers

- Startup after settings load.
- Event writes when byte accounting or browser estimates show budget pressure.
- Immediate settings-save enforcement when `cache.maxBytes` is lowered.
- Manual diagnostics action from an existing storage or Stats surface.
- Quota-pressure recovery when browser estimates cross the safety threshold.
