# Emoji Palette

## Purpose

Emoji palette defines the shared reaction and compose picker used on event rows
and Tweet toolbars.

## Canonical Component

- `EmojiPaletteButton` is the only entry point.
- It wraps `AnchoredPopover` and `EmojiPopover`.
- `EventEmojiPanel` and other duplicate picker shells are not allowed.

## Placement

- Popovers portal to the nearest tile host (`[data-pane-id] .pane-stack` or
  `document.body`) so virtua row dematerialization does not destroy an open
  picker.
- Popovers use tile-scoped bounds from `[data-pane-id]`.
- Preferred placement is `bottom-start` for event actions and Tweet toolbar.
- When space below is insufficient, the picker flips above while staying inside
  the pane content rectangle.
- Open state must not change row height.
- Popover stays hidden until the first position pass completes.

## Async Sizing

`emoji-picker-element` loads asynchronously. The popover must:

- reposition after the web component mounts,
- observe popover content size changes,
- update on window resize and scroll capture.

## Virtual List Hazard

Event rows render inside Virtua lists. Inline popover DOM inside a recycled row
is destroyed when the row scrolls offscreen. Portal mounting is required for
reliable open behavior.

## Custom Emoji Strip

When the active account emoji source is available, a custom emoji strip may
render above the native picker. Failures fall back to Unicode picker only.

## Event Actions

Event rows keep inline heart, repost, reply, and zap buttons. The emoji palette
is the fifth icon action and publishes NIP-25 reactions.

## Related

- [reaction-surfaces.md](reaction-surfaces.md).
- [../tile-overlays.md](../tile-overlays.md).
- [../../../product/tools/event-actions.md](../../../product/tools/event-actions.md).
- [../../../protocol/custom-emoji.md](../../../protocol/custom-emoji.md).
