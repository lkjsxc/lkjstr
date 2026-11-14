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
history. Reopening the same preview activates it without adding history.
Ctrl/Cmd-click keeps a detail; double-clicking a tab or pressing Enter
twice keeps a preview. Editing also keeps it. Identical views always open
independently. Closing the last tab leaves a New tab page.

Each tab retains up to 64 history entries. Alt+Left/Right, mouse side buttons
and browser Back navigate the focused tab. The URL hash contains only public
view data, including search text; every view can be linked. Closed tabs/tiles
reopen with Ctrl/Cmd+Shift+T. Alt+Z restores a layout snapshot. Recovery is
bounded to 32 snapshots and lasts for this page lifetime.
Closing a tile records one recovery and undo action before applying that cap.

## Gestures

- Drag a tab onto a tile edge to split, onto its body to stack, along a strip
  to reorder; a preview shows the drop.
- Drag the gap between tiles to resize; sizes commit on release.
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
