# Tabs

## Purpose

Tabs define the workspace surface area.

## New Tab Choices

- Home
- Tweet
- Notifications
- Search
- Global
- Profile Edit
- Accounts
- Relay Settings
- Stats
- Settings
- Upload Settings
- lkjstr Log
- Mine npub
- Welcome

## Action-Opened Tabs

- Welcome is the clean first-launch tab and can also be opened from New Tab.
- Welcome gives startup guidance for accounts, relays, Tweet, Home, and Global.
- Profile opens from identity buttons in timelines and profile-related UI.
- Profile actions focus a matching Profile tab already present in the same
  tile; otherwise they open a new Profile tab in that tile.
- Profile Edit opens from the active account profile action. The tab focuses an
  existing Profile Edit tab in the same tile before creating one.
- Profile Edit always edits the current active signing account.
- Upload Settings opens from New Tab and edits the shared Tweet media upload
  provider records.
- Thread opens from event rows, event id buttons, quotes, references, and
  collapsed continuation rows.
- Thread actions focus a matching Thread tab already present in the same tile;
  otherwise they open a new Thread tab in that tile.
- Mine npub owns vanity key generation. Accounts can add exported results only
  after explicit user action.
- Stats is a workspace tab kind named `network-stats`.
- Search runs local cached content matches and relay NIP-50 search filters.

## Movement

- Tabs can be dragged to reorder within a tile.
- Tabs can be dragged into another tile, or to a tile edge to split there.
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
