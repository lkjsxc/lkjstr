# Workspace

## Purpose

The tiled workspace: model, gestures, shortcuts and persistence.

## Model

`lkjstr-core::layout` is a tree of splits (row or column, with sizes) and panes
(tab stacks). It was ported from ytenrich's window manager, whose tree began as
lkjstr's own. `Workspace` adds the view of each tab and the focused pane. All
edits are pure functions with tests in `crates/lkjstr-core/tests/`.

Opening a note or person uses `Open::Beside`: the pane to the right of the
focused one, or a new split on the right. Singleton views (Home, Global,
Notifications, Relays, Accounts, Settings, Welcome) are focused, not duplicated.
Closing the last tab leaves a New tab page.

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
| Alt+H/J/K/L or arrows | focus tile left, below, above, right |
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

Under 760px only the focused tile is shown and new views open in place.

## Persistence

The workspace is saved to IndexedDB (`kv/workspace`) 400 ms after each change
and repaired on load (unknown tabs dropped, focus fixed). No migrations.
