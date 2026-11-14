# Workspace

## Purpose

The tiled workspace: model, gestures, shortcuts and persistence.

## Model

`lkjstr-core::layout` is a tree of splits (row or column, with sizes) and panes
(tab stacks). It was ported from ytenrich's window manager, whose tree began as
lkjstr's own. `Workspace` adds the view of each tab and the focused pane. All
edits are pure functions with tests in `crates/lkjstr-core/tests/`.

Opening a note or person uses a preview in the pane to the right. With no
neighbour, it splits only if both halves retain 360px; otherwise it adds a tab
here. The next preview replaces the previous preview, retaining back/forward
history. Opening an identical preview keeps the old tab and creates an independent one.
Ctrl/Cmd-click keeps a detail; double-clicking a tab or pressing Enter
twice keeps a preview. Editing also keeps it. Identical views always open
independently. Closing the last tab removes its tile; the final remaining tile
becomes a New tab page. Closing an active tab selects the most recently active
surviving tab in that tile, then its right or left neighbour. Inactive closure
does not select another view. Middle-close is enabled by default and can be
disabled. Pin moves a tab first and protects it from bulk closure. Duplicate
copies its view and navigation history, with an independent draft key.

Each tab retains up to 64 history entries. Alt+Left/Right, mouse side buttons
and browser Back navigate the focused tab. Clean public paths describe the focused tab; searches alone use a query string.
Unaddressed image and website tiles retain their state only in the saved desk. Closed tabs/tiles
reopen with Ctrl/Cmd+Shift+T. Alt+Z restores a layout snapshot. Recovery is
bounded to 32 snapshots and lasts for this page lifetime.
Closing a tile records one recovery and undo action before applying that cap.

## Gestures

- Drag a tab onto a tile edge to split, onto its body to stack, along a strip
  to reorder; a preview shows the drop.
- Drag the gap between tiles to resize live; sizes commit on release. Visible
  feed anchors are retained during the gesture. Double-click equalises the
  adjacent pair; Alt+Enter zooms the focused tile and restores it.
- `+` opens the launcher; the tile menu splits, widens, narrows, closes and
  resets the layout.

## Shortcuts

Workspace chords use Alt and match physical keys:

| Keys | Action |
| --- | --- |
| Alt+H/J/K/L | focus tile left, below, above, right |
| Alt+Shift+H/J/K/L | move tab there (split at the edge) |
| Alt+\ and Alt+- | split right, split down |
| Alt+T, Alt+W | new tab, close tab |
| Alt+[ and Alt+] | previous, next tab |
| Alt+1..9 | tab by position |
| Alt+. and Alt+, | widen, narrow tile |

Outside text fields: `j`/`k` move between notes, `Enter` or `o` opens the
thread, `p` the profile, `r` replies, `l` likes, `n` composes, `/` searches,
`?` shows all shortcuts. The source of truth is `SHORTCUTS` in
`crates/lkjstr-web/src/ui/keys.rs`.

## Narrow screens

Under 760px the focused tile fills the entire desk, overriding all ancestor
split fractions. Tabs scroll horizontally; bottom icons open Home, Search,
Compose, Notifications and a More sheet containing accounts and settings.

## Persistence

The workspace is saved to IndexedDB (`kv/workspace`) 400 ms after each change
and repaired on load (unknown tabs dropped, focus fixed). No migrations.

## Nine workspaces

Numbered chips sit after status and before search in the desktop top bar; on
phones they live in More. Alt+Shift+1..9 selects a workspace. The tab menu,
Ctrl+Alt+Shift+1..9, and dropping onto a chip move a tab while retaining its
identity, history, draft key and scroll key. Names can be edited in Settings
and searched in the palette. Dots reflect newer relevant notes already in the
shared cache; hidden workspaces do not poll merely to produce a dot.

The runtime and cache are shared. Layouts are independent and hidden views
release wants. View bodies currently remount on a workspace switch, so instant
DOM retention and a subscription grace period remain unfinished. Discovery
starts with Global and Search; Writing starts with Compose and Notifications.
The extra hashtag launcher and own-profile preset are still missing.

Boot reads the atomic `spaces` snapshot before drawing. It includes all nine
layouts, their names, activity timestamps and the last selected workspace.
Debounced saves also write `workspace:<index>` mirrors and the current
`workspace` key. Pagehide initiates a final save. A storage-event channel syncs
layout edits between same-origin browser tabs without changing the receiver's
active workspace; identical writes terminate echoes. Bad saved banks are
rejected, and individual layouts are repaired with native-tested bounds.

Allocation carries a bank-wide high-water mark across switches and moves,
including closed identities. Reset layouts receive fresh tab and node IDs;
boot and same-origin imports reserve IDs and reject cross-desk tab collisions.
Zoom clears on workspace switches and when its tile disappears. Nested manual
reference loads inherit their owning view visibility and release wants when hidden.

Recovery refuses snapshots that would duplicate a tab identity now owned by
another workspace. Coordinated cross-workspace move Undo remains unfinished.

## Size limits

Every pane is a size-query container. The four width classes simplify note
avatars, actions, media, settings and relay rows independently of window size.
Short tiles hide secondary rows. The tab list scrolls independently of its
New tab, All tabs and menu controls. Settings stores tab width, scale and
middle-click preference per device. Resizing clamps to 160px wide or 96px high;
new explicit splits are refused when both halves cannot retain those minima.
Keyboard resize uses exact 40px steps clamped to subtree minima. Complete touch
conventions and menu shortcut coverage remain open.
