# Pane Chrome Scope

## Purpose

Pane chrome scope defines which screen regions participate in tab drag hit
testing and drop preview geometry. It prevents edge-split zones from firing
while the pointer is over tile header chrome.

## Regions

| Region       | DOM anchor    | Role in drag resolution                         |
| ------------ | ------------- | ----------------------------------------------- |
| `paneRect`   | `.pane`       | Full tile bounds; center preview extent         |
| `chromeRect` | `.pane-head`  | Header chrome; always maps to `center` zone     |
| `bodyRect`   | `.pane-stack` | Content stack; edge corridors and edge previews |
| `stripRect`  | `.tab-strip`  | Tab rail; strip-priority reorder on source pane |

`chromeBottom` is `chromeRect.bottom` in viewport coordinates. It is **not**
limited to the tab strip height. Tile menu, new-tab control, and tab rail share
the same header row and must be treated as chrome together.

## Coordinate Rules

- `inChrome = clientY <= chromeBottom` forces `center` (reorder or move).
- Edge zones run only when `!inChrome` and the pointer is inside `bodyRect`.
- If `clientY < bodyRect.top` but the pointer is not in chrome (layout gap),
  resolve `center` instead of clamping to the body top edge.
- `tabDropZone` receives coordinates relative to `bodyRect` only after the
  chrome guard passes.

## Preview Offsets

`PaneDropLayer` covers the full pane (`inset: 0`). Edge previews use body
dimensions and a vertical offset:

- `bodyOffsetTop = bodyRect.top - paneRect.top`
- Edge overlay `top` for `top` / `bottom` zones starts at `bodyOffsetTop`, not `0`.

Center preview still covers the full pane (strip + body).

## Measurement

`paneChromeRects(pane)` returns `paneRect`, `bodyRect`, `chromeBottom`, and
`stripBottom`. `stripBottom` remains available for source-pane strip-priority
reorder only.

## Related

- [pane-drop-target.md](pane-drop-target.md): zone table and commit behavior.
- [tab-dragging.md](tab-dragging.md): pointer and native drag overview.
- [tab-strip-gestures.md](tab-strip-gestures.md): strip-priority reorder.
