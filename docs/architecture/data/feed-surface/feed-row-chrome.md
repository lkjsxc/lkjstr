# Feed Row Chrome

## Purpose

Feed row chrome defines how list items draw separators, embed event rows, and
reserve space for controls beside scrollbars.

## Contract

- **List-owned separators:** the outer list item wrapper draws at most one
  bottom border between logical rows. Inner rows must not add a second border.
- `EventRow` accepts `showSeparator` (default `true`). When `false`, the row
  uses `.event-row--embedded` with no bottom border.
- Notification rows draw the separator on `.notification-row`. Embedded
  `EventRow` instances pass `showSeparator={false}`.
- Feed timeline rows keep `showSeparator={true}` on `.event-row`.
- Event More menu and row text reserve inline-end space using
  `--scroll-content-inset` on `.event-main` and on `.event-more`.
- Virtua item wrappers use `.feed-scroll-item` for inline-end padding. Do not
  rely only on `.event-list__viewport > *` because Virtua wraps each row.
- Wide content must wrap or clip inside the scroll root. Rows use `min-width: 0`
  on flex and grid children.

## Notification Embed Rules

- Notification meta header sits above the embedded `EventRow`.
- Embedded `EventRow` keeps full actions and More menu per
  [notifications.md](../../../product/feeds/notifications.md).
- Only the separator is suppressed on the embedded row, not actions or density.

## Types

`src/lib/feed-surface/row-shell.ts` exports list item key helpers and documents
row chrome types used by feed adapters.

## Related

- [feed-scroll-surface.md](feed-scroll-surface.md): scroll shell.
- [event-tree.md](../event-tree.md): tree row model.
- [scroll-layout.md](../../workspace/scroll-layout.md): inset tokens.
