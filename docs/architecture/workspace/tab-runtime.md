# Tab Runtime

## Purpose

Tab runtime defines valid tab kinds and lifecycle ownership.

## Kinds

`new-tab`, `timeline`, `global`, `notifications`, `profile`,
`profile-edit`, `account-manager`, `npub-miner`, `thread`, `relay-monitor`,
`relay-settings`, `tweet`, `settings`, `search`, `upload-settings`,
`network-stats`, `author-context`, and `welcome`.

## Contract

- New Tab can convert only to direct New Tab choices.
- Profile, Profile Edit, and Thread remain valid tab kinds but open from
  actions.
- Mine npub is a valid New Tab choice and owns the worker-backed vanity miner.
- lkjstr Log uses the existing `relay-monitor` tab kind, opens from New Tab,
  and owns read-only current-session relay diagnostics.
- Relay Settings owns relay editing.
- Conversion preserves tab id and tab group.
- Closing a tab must close any runtime subscription owned by that tab.
- Closing a tab must abort one-shot reads owned by that tab.
- Inactive tabs keep mounted bodies in the pane stack but hide them and pause
  feed runtimes. See [tab-body-mount.md](tab-body-mount.md).
- `tabs.inactiveRetentionSeconds` retains a bounded in-memory UI snapshot for
  reload and missing-mount restore. It does not keep live relay subscriptions
  on hidden tabs.
- Tab snapshots are tab-kind aware. Capture runs on every blur.
- Feed tabs store virtual list anchor event id and offset, optional
  `scrollTop`, compound feed cursors (`oldestCursor`, `newestCursor`),
  `hasOlder`, `hasNewer`, and surface filter state when applicable.
- Tool tabs store scroll position and `fields` key-value pairs for cheap UI
  state (Search query, Tweet draft content hash, etc.).
- IndexedDB `tabStates` stores durable snapshots for reload restore. Session
  snapshots provide fast restore within the TTL window.
- Session-memory retains at most `32` warm snapshots (LRU by tab id). TTL is
  `tabs.inactiveRetentionSeconds` (default `300`).
- On focus, prefer live DOM state when the body stayed mounted. Otherwise
  restore order is session `take`, then IndexedDB `load`, then runtime recreate.
  Runtimes seed from restored cursors and cache-first reads before relay scans
  where the feed contract requires it.
- `tabRuntimeRegistry` captures runtime-owned snapshot fields on blur via
  `captureRuntimeSnapshot(tabId)` before `persistTabSnapshot`.
- When retention is positive, a tab reselected within the window may use a
  session snapshot when mount state is missing; mounted bodies restore from DOM
  first.
- Retention expiry drops the in-memory snapshot only. Hidden bodies remain
  mounted; feed subscriptions stay paused until the tab is active again.
- Closing a tab, changing runtime configuration, or retention expiry closes
  owned subscriptions immediately.
- Moving a tab removes and inserts the existing tab id without recording closed
  history.
- Same-tile movement reorders the tab group.
- Cross-tile movement updates source and target tab groups, then focuses the
  moved tab in the target tile.
- Persisted tabs are normalized by the current tab contracts. Stale tab kinds,
  including retired `cache-status` tabs, are dropped during recovery.
- Timeline runtime recreation is guarded by primitive keys:
  `kind | activeAccountPubkey | sortedNormalizedRelays | tabId`. Equivalent
  relay order, unrelated settings, notification refreshes, and local state
  changes do not rebuild Home or Global subscriptions.
- Timeline runtime create and close events are written to lkjstr Log.
- Runtime lifecycle logs include tab id, runtime kind, relay count, reason,
  uptime, item count, and subscription counters when available.
- Tab snapshot retention records cleanup reasons for expiry, tab removal,
  retention setting changes, and pane destroy so snapshot lifecycle is
  diagnosable.
- Tab snapshot handles are factory-created resources with explicit
  `releaseAll` cleanup.
- Runtime counters are debug-only. `debug.showRuntimeCounters` defaults to
  `false`; Stats is the only tab that renders them.
