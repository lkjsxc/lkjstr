# Tab Runtime

## Purpose

Tab runtime defines valid tab kinds and lifecycle ownership.

## Kinds

`new-tab`, `timeline`, `global`, `notifications`, `profile`,
`account-manager`, `thread`, `relay-monitor`, `relay-settings`, `tweet`,
`settings`,
`cache-status`.

## Contract

- New Tab can convert only to direct New Tab choices.
- Profile and Thread remain valid tab kinds but open from timeline actions.
- lkjstr Log uses the existing `relay-monitor` tab kind, opens from New Tab,
  and owns read-only current-session relay diagnostics.
- Relay Settings owns relay editing.
- Conversion preserves tab id and tab group.
- Closing a tab must close any runtime subscription owned by that tab.
- Inactive tabs stay mounted while retained. The retention period is configured
  by `tabs.inactiveRetentionSeconds`.
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
- Persisted tabs are normalized by the current tab contracts.
