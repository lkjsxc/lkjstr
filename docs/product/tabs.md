Owner: Product
State: Canon

# Tabs

## Purpose

Tabs let one pane switch between Nostr views and workspace tools.

## Tab Group Contract

- A tab group can contain zero tabs.
- `activeTabId: null` is valid when a group is empty.
- Closing the active tab activates the nearest remaining tab.
- Closing the final tab leaves the pane and empties the tab group.
- Closed tabs must release live subscriptions and timers.
- Opening a tab in an empty pane sets it active and focuses the pane.

## Tab Kinds

- Timeline.
- Notifications.
- Profile.
- Account manager.
- Post manager.
- Thread.
- Relay monitor.
- Composer.
- Settings.
- Cache status.

## Acceptance

- A user can close all tabs without a blank workspace.
- Activity bar actions reopen tabs from zero-tab state.
- Reloading a zero-tab pane restores the empty pane.
