# Cache Budget

## Purpose

Define the enforced local site storage target and how prunable cache resources
absorb storage pressure.

## Contract

- `cache.maxBytes` defaults to `67108864` bytes.
- The setting is a site storage target, not a cache row-count limit.
- When browser storage estimates are available, total estimated site usage is
  kept under the lower of `cache.maxBytes` and the browser quota pressure
  threshold when enough prunable local-cache data exists.
- `cacheLedger` byte accounting identifies prunable cache resources. Browser
  estimates remain authoritative for origin usage.
- Compaction preserves accounts, local signing secrets, settings, relay sets,
  workspace state, Tweet drafts, active tab snapshots, active jobs, user-owned
  relay configuration, latest metadata needed by cached pubkeys, active-account
  follow lists, runtime pins, newest retained notifications, open feed keys,
  and explicit `forceProtected` rows.
- Compaction stops cleanly when browser usage is under target, ledger bytes are
  under target and browser usage is unavailable, no prunable candidates remain,
  or only dynamically protected candidates remain.
- If protected or unknown usage alone exceeds the target, report
  `protected-or-unknown-usage` and do not delete protected records.
- Stats must show a storage inventory so the user can see which IndexedDB
  tables, ledger resource kinds, and browser-overhead gap consume the budget.

## Algorithm

1. Load `cache.maxBytes`; if absent, use `67108864`.
2. Read app-owned cache byte accounting from indexed `cacheLedger` rows.
3. Read `navigator.storage.estimate()` when supported.
4. Compute the site target as `cache.maxBytes`, clamped by quota pressure when
   a browser quota estimate exists.
5. Estimate protected user bytes, prunable ledger bytes, and unknown or
   overhead bytes from table inventory plus browser usage.
6. Compact score-ordered prunable ledger rows until the target is met or no
   eligible candidate remains.
7. Re-read ledger bytes and browser usage after each batch when possible.
8. Record the result in `cacheMeta`: site budget bytes, ledger bytes, prunable
   bytes, protected estimate, unknown or overhead bytes, browser usage bytes,
   pruned resource count, pruned byte estimate, skipped reason, and remaining
   pressure state.
9. Diagnostics estimate per-table bytes and report browser usage not explained
   by table JSON estimates as overhead or unknown usage.

## Triggers

- Startup after settings load.
- Cache writes when byte accounting or browser estimates show budget pressure.
- Immediate settings-save enforcement when `cache.maxBytes` is lowered.
- Manual diagnostics action from an existing storage or Stats surface.
- Quota-pressure recovery when browser estimates cross the safety threshold.
