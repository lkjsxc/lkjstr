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
- Inactive tabs stay mounted while retained. The retention period is configured
  by `tabs.inactiveRetentionSeconds`.
- Retained tab DOM remains mounted in a stacked pane-body layout with inactive
  bodies visually hidden but still sized to the active body.
- When retention is positive, an inactive tab remains mounted for that many
  seconds after it loses focus. Its feed runtime remains keyed by tab id.
- Retention expiry closes runtimes and owned subscriptions for that inactive
  tab. Focusing the tab before expiry resumes the retained component.
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
- Tab retention records close reasons for expiry, tab removal, retention
  setting changes, and pane destroy so retained runtime teardown is diagnosable.
- Tab retention handles are factory-created resources with explicit
  `releaseAll` cleanup.
- Runtime counters are debug-only. `debug.showRuntimeCounters` defaults to
  `false`; Stats is the only tab that renders them.
