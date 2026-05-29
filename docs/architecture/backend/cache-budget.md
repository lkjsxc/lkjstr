# Cache Budget

## Purpose

Define the enforced local event-cache byte budget.

## Contract

- `cache.maxBytes` defaults to `67108864` bytes.
- The setting is an event-cache byte budget, not an event-count limit.
- Browser quota estimates are pressure input only. They do not define which
  app tables may be deleted.
- Compaction preserves accounts, local signing secrets, settings, relay sets,
  workspace state, notifications, Tweet drafts, tab snapshots, relay
  configuration, latest metadata needed by cached pubkeys, active-account
  follow lists, runtime pins, notification-critical events, and explicit
  `forceProtected` rows.
- Compaction stops cleanly when the event cache is under budget or no
  prunable event candidates remain.

## Algorithm

1. Load `cache.maxBytes`; if absent, use `67108864`.
2. Read app-owned event-cache byte accounting from indexed priority rows.
3. Read `navigator.storage.estimate()` when supported.
4. If event-cache bytes exceed the setting, compact score-ordered prunable
   events until under budget or no candidates remain.
5. If browser usage exceeds the setting, use it as additional pressure and run
   a more aggressive event-cache pass, but never delete protected user tables.
6. If browser usage is over budget while event-cache bytes are already under
   budget, report `protected-or-non-cache-usage`.
7. Record the result in `cacheMeta`: budget bytes, estimated event-cache bytes,
   browser usage bytes, pruned rows, pruned byte estimate, skipped reason, and
   whether only protected rows remain.

## Triggers

- Startup after settings load.
- Event writes when byte accounting or browser estimates show budget pressure.
- Immediate settings-save enforcement when `cache.maxBytes` is lowered.
- Manual diagnostics action from an existing storage or Stats surface.
- Quota-pressure recovery when browser estimates cross the safety threshold.
