# Tabs

## Purpose

Tabs define the workspace surface area.

## New Tab Choices

- Home
- Tweet
- Notifications
- Search
- Custom Request
- Global
- My Profile (only when a signing account is active; opens the active account profile)
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

- Welcome is the clean first-launch tab in the top startup pane and can also be
  opened from New Tab.
- Welcome gives quick-start status for accounts, relays, Home, Notifications,
  Search, Tweet, and the core workspace surfaces.
- Profile opens from identity buttons in timelines and profile-related UI.
- Profile actions focus a matching Profile tab already present in the same
  tile; otherwise they open a new Profile tab in that tile.
- Profile Edit opens from the active account profile action. The tab focuses an
  existing Profile Edit tab in the same tile before creating one.
- Profile Edit always edits the current active signing account.
- Upload Settings opens from New Tab and edits the shared Tweet media upload
  provider records.
- Thread opens from event rows, event id buttons, quotes, compact reference
  cards, notification event bodies, fallback notification context, and
  collapsed continuation rows.
- Thread actions focus a matching Thread tab already present in the same tile;
  otherwise they open a new Thread tab in that tile.
- Author Context opens from an event row menu and loads the anchor plus nearby
  authored events in the same tile.
- Custom Request opens from New Tab, validates JSON relay filters, and renders
  real relay results with the shared event row surface.
- Mine npub owns vanity key generation. Accounts can add exported results only
  after explicit user action.
- Stats is a workspace tab kind named `network-stats`.
- Search runs local cached content matches and relay NIP-50 search filters.
- Tweet clears immediately after signed local queueing. Notifications show
  lightweight action context headers and render source notification events with
  canonical Timeline row behavior; target/root context is fallback-only.

## Movement

- Tabs can be dragged to reorder within a tile with pointer dragging or native
  desktop drag-and-drop.
- Tabs can be dragged into another tile, or to a tile edge to split there.
- Pane drop feedback shows a center insert highlight over the full tile header
  and body when reordering or moving into a group, or a half-pane-body edge
  preview aligned with the content stack. Edge split feedback never covers the
  tab strip or tile menu row.
- Long-press and drag do not select tab label text. Touch uses long-press before
  drag; the rail keeps horizontal pan until drag arms.
- Moving a tab activates and focuses it in the target tile.
- Moving the last tab out of a tile closes the source tile.
- Invalid drops do nothing.

## Tab Rail

- Each tile header uses a single-row horizontally scrollable tab rail.
- Left and right fade edges indicate hidden tabs when the rail overflows.
- The focused tab scrolls into view when focus changes, a tab is inserted, or a
  tab is moved into the rail.
- Coarse pointers (touch) pan the rail horizontally by default. A long press
  arms tab drag; until then the browser handles horizontal panning.
- Fine pointers (mouse, pen) start drag after a small movement threshold.
- While the pointer stays in the source tab-strip band, reorder intent takes
  precedence over edge-split capture on the target tile.

## Fit

- Tab titles truncate inside fixed tab frames; the rail scrolls instead of
  wrapping to multiple rows.
- Pane content must not create horizontal scrolling.
- Tab bodies fill the pane body height and keep scroll ownership local.
- Inactive tab bodies unmount when focus changes. Every blur writes a durable
  IndexedDB snapshot and, within `tabs.inactiveRetentionSeconds`, a session
  snapshot (up to `32` warm tabs) with scroll anchors, feed cursors, `hasOlder`,
  `hasNewer`, and surface-local fields such as Search query.
- Reselecting a tab restores scroll (including top-of-list), list anchor, and
  feed cursors from session when possible, otherwise from IndexedDB after reload.
  Live relay subscriptions are always recreated; cached events repopulate the
  window before network. See
  [tab-retention-flow.md](../../architecture/workspace/tab-retention-flow.md).

## Removed Surface

There is no retired draft-planning workspace tab. Thread and Author Context are
opened from actions rather than free-form New Tab inputs.
