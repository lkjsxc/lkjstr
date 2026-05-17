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
- New tab creation is a per-tile plus action.
- The plus action opens a `new-tab` chooser in the current tile.
- The chooser converts itself into the selected tab kind without changing id.
- Tab close buttons render inside the visual tab frame.

## Tab Kinds

- New Tab.
- Timeline.
- Notifications.
- Profile.
- Account manager.
- Post manager.
- Thread.
- Relay monitor.
- Relay settings.
- Composer.
- Settings.
- Cache status.

## Acceptance

- A user can close all tabs without a blank workspace.
- Tile plus actions open a New Tab chooser in the clicked tile.
- New Tab can become timeline, profile, relay settings, posts, notifications,
  settings, accounts, composer, cache, thread, or a custom timeline.
- Reloading after a final-tab close restores the recovered workspace.
