# Tab Strip Gestures

## Purpose

Tab strip gestures define how pointer input chooses between horizontal rail
scrolling, reordering, and cross-tile moves.

## Constants

| Input                      | Constant                 | Value                          |
| -------------------------- | ------------------------ | ------------------------------ |
| Touch long-press delay     | `touchLongPressMs`       | 250                            |
| Long-press cancel distance | `touchLongPressCancelPx` | 8                              |
| Mouse drag activation      | `mouseDragActivationPx`  | 6                              |
| Source strip band height   | `tabStripBandPx`         | measured from tab strip layout |

## Coarse Pointer (Touch)

- The tab rail uses `touch-action: pan-x` by default so the browser can scroll
  hidden tabs horizontally.
- `touch-action: none` applies only while a drag is armed or active.
- `pointerdown` on a tab frame starts a long-press timer. Movement beyond
  `touchLongPressCancelPx` before the timer fires cancels the pending drag and
  leaves panning enabled.
- When the timer fires, the gesture arms drag, calls `setPointerCapture` on the
  tab main control, and follows the pointer drag path in
  [tab-dragging.md](tab-dragging.md).
- Tab frames use `draggable={false}` on coarse pointers to avoid conflicting
  native HTML5 drag.

## Fine Pointer (Mouse, Pen)

- `pointerdown` with the primary button starts tracking immediately.
- Drag activates after movement exceeds `mouseDragActivationPx`.
- `setPointerCapture` runs on activation.
- Native HTML5 drag remains enabled for desktop reorder and cross-tile moves.

## Selection Suppression

While `body.tab-strip-drag-arming` or `body.dragging-tab` is set:

- `user-select: none` applies to `body`, `.tab-strip`, `.tab-frame`, and
  `.tab-main`.
- `selectstart` on `.tab-frame` and `.tab-main` is prevented.
- `body.tab-strip-drag-arming` is set on primary `pointerdown` on `.tab-main` and
  cleared on pointer up, cancel, or drag clear.
- Coarse pointers use `touch-action: none` while the long-press timer is pending
  or while drag is armed or active.
- Long-press must not select tab label text before drag arms.

Native HTML5 drag sets `body.dragging-tab` on `dragstart` immediately.

## Strip Priority

- While the pointer remains inside the source pane tab-strip band, reorder
  intent suppresses edge-split zones on the target pane.
- Leaving the strip band allows normal pane-wide zone resolution.
- Same-pane reorder uses tab frame positions and excludes the dragged tab id
  from insertion index math.

## Active Tab Reveal

- When the active tab changes, a tab is inserted, or a tab moves into the
  rail, the active tab frame scrolls into view inside the rail using nearest
  inline alignment.

## Fade Edges

- When `scrollWidth > clientWidth`, left and/or right fade overlays indicate
  off-screen tabs.

## Related

- [pane-chrome-scope.md](pane-chrome-scope.md): header chrome exclusion.
- [tab-dragging.md](tab-dragging.md): drop resolver.
