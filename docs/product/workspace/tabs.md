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
- Public Chat
- lkjsxc
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
- Followees opens from Profile following counts and profile-related actions. It
  focuses a same-tile Followees tab with the same viewed pubkey before creating
  one.
- User Timeline opens from Profile actions, Followees rows, the fixed `lkjsxc`
  New Tab choice, and future identity-related menus. It focuses a same-tile User
  Timeline tab with the same target pubkey before creating one.
- The `lkjsxc` New Tab choice opens User Timeline for
  `0f38afb23cec30570ee64f9a4aa099229395ec3371c5fe867e09c9111480015d` and does
  not require an active signing account. It is a suggested public timeline, not
  Global and not a personalized account Home feed.
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
- The `lkjsxc` option matches aliases `lkjsxc`, `starter`, `recommended`,
  `public timeline`, and `npub1puu2`.
- Tweet clears immediately after signed local queueing. Notifications show
  lightweight action context headers and render source notification events with
  canonical Timeline row behavior; target/root context is fallback-only.
- Public Chat opens from New Tab and renders real NIP-28 channels and messages.

## New Tab Layout

- New Tab shows one flat option grid in canonical catalog order.
- Each option card shows label and short description.
- New Tab has no search input, filter label, result count, or primary/secondary
  headings.
- Svelte and Leptos use the same pure catalog data and ordering rules.

## Movement

- Tabs can be dragged to reorder within a tile with pointer dragging or native
  desktop drag-and-drop.
- Tabs can be dragged into another tile, or to a tile edge to split there.
- Pane drop feedback shows a center insert highlight over the pane body when
  reordering or moving into a group, or a half-pane-body edge preview on splits.
  Drop feedback never covers the tab strip or tile menu row.
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
- Inactive tab bodies stay mounted but hidden; feed runtimes pause. Every blur
  writes a durable SQLite OPFS worker tab snapshot and, within
  `tabs.inactiveRetentionSeconds`, a session snapshot (up to `32` warm tabs) for
  reload backstop.
- Reselecting a tab keeps scroll, list anchor, and form fields from the hidden
  DOM when possible; session and durable worker snapshots apply after reload or
  missing mount.
  Active feed tabs resume relay work from restored cursors; cached events
  repopulate the window before network. See
  [tab-body-mount.md](../../architecture/workspace/tab-body-mount.md) and
  [tab-retention-flow.md](../../architecture/workspace/tab-retention-flow.md).

## Removed Surface

There is no retired draft-planning workspace tab. Thread and Author Context are
opened from actions rather than free-form New Tab inputs.
