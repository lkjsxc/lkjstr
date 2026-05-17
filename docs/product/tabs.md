Owner: Product
State: Canon

# Tabs

## Purpose

Tabs let one pane switch between Nostr views and workspace tools.

## Tab Group Contract

- A tab group contains at least one tab after each workspace command.
- `activeTabId` points to an existing tab after recovery.
- Closing the active tab activates the nearest remaining tab.
- Closing the final tab closes its tile.
- Closing the final tab in the final tile creates a recovery timeline tile.
- Closed tabs must release live subscriptions and timers.
- Opening a tab uses the focused tile or recovers a tile first.
- New tab creation is a sidebar action.

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
- Sidebar actions open tabs in the focused or recovered tile.
- Reloading after a final-tab close restores the recovered workspace.
