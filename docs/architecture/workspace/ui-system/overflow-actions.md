# Overflow Actions

## Purpose

Overflow actions keep primary surfaces compact by moving secondary commands
into a three-dot menu.

## Pattern

- Trigger: `MoreHorizontal` icon inside a `details`/`summary` or equivalent
  anchored menu.
- Placement: inline end of the row or header action cluster.
- Row click still performs the primary action unless the click target is inside
  the menu or another interactive control.
- Menu clicks call `stopPropagation` so row navigation does not fire.

## User List Rows

Followees rows use this pattern:

- Primary: row click opens Profile.
- Overflow: Open User Timeline, Copy npub.

Inline `Profile`, `Timeline`, and `Copy npub` buttons must not appear on list
rows.

## Profile Header

Profile keeps copy actions in the existing overflow menu:

- Copy npub
- Copy nprofile
- Copy follow list JSON
- Copy relay sets JSON
- Open user timeline

`Open user timeline` must not appear as a large standalone fact button.

## Media Upload

When upload is not configured, surfaces show `UploadGateHint` instead of a
silent disabled control. The hint opens Upload Settings on click.

## Event Rows

Event row primary actions remain inline icon buttons: heart, repost, reply,
zap, emoji. Event More menus stay separate from identity overflow menus.

## Accessibility

- Overflow trigger has an `aria-label`.
- Open menu items are keyboard reachable.
- Copied feedback uses `role="status"` without shifting row geometry.
- Copy npub actions report clipboard unavailable or rejected writes explicitly;
  copied feedback appears only after the browser clipboard write resolves.

## Related

- [identity-surfaces.md](identity-surfaces.md).
- [media-upload-gate.md](media-upload-gate.md).
- [../../../product/feeds/followees.md](../../../product/feeds/followees.md).
