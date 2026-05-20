# Tabs

## Purpose

Tabs define the workspace surface area.

## New Tab Choices

- Home
- Global
- Relay Settings
- lkjstr Log
- Notifications
- Accounts
- Tweet
- Settings
- Cache

## Action-Opened Tabs

- Profile opens from identity buttons in timelines and profile-related UI.
- Profile actions focus a matching Profile tab already present in the same
  tile; otherwise they open a new Profile tab in that tile.
- Thread opens from event rows, event id buttons, quotes, references, and
  collapsed continuation rows.
- Thread actions focus a matching Thread tab already present in the same tile;
  otherwise they open a new Thread tab in that tile.

## Movement

- Tabs can be dragged to reorder within a tile.
- Tabs can be dragged into another tile.
- Moving a tab activates and focuses it in the target tile.
- Moving the last tab out of a tile closes the source tile.
- Invalid drops do nothing.

## Fit

- The tab strip wraps or compresses tab titles inside the tile width.
- Tab text may truncate, but pane content must not create horizontal scrolling.
- Tab bodies fill the pane body height and keep scroll ownership local.
- Retained inactive tab bodies are stacked in the same pane-body layer instead
  of hidden with `display:none`; this preserves body geometry and scroll
  position when a retained tab becomes active again.

## Removed Surface

There is no retired draft-planning workspace tab. There is no free-form
profile, thread, or filter JSON input in New Tab.
