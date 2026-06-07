# Scroll Ownership

## Purpose

Maps each workspace tab kind to its shell class and scroll root so split-pane
scrollbar position stays consistent across tab switches.

## Feed Tabs

Feed tabs use `.feed-tab` with exactly one `[data-scroll-owner]` child.

| Tab kind       | Tab root class                     | Scroll root                 |
| -------------- | ---------------------------------- | --------------------------- |
| Home / Global  | `.feed-tab` / `.timeline-tab`      | `.event-list__viewport`     |
| Profile        | `.feed-tab` / `.profile-tab`       | `.event-list__viewport`     |
| Thread         | `.feed-tab`                        | `.event-list__viewport`     |
| Search         | `.feed-tab`                        | `.event-list__viewport`     |
| Notifications  | `.feed-tab`                        | `.notification-list-scroll` |
| Followees      | `.feed-tab` / `.followees-tab`     | `.event-list__viewport`     |
| User Timeline  | `.feed-tab` / `.user-timeline-tab` | `.event-list__viewport`     |
| Custom Request | `.feed-tab`                        | tab-specific scroll root    |
| Author Context | `.feed-tab`                        | `.event-list__viewport`     |

Leading identity headers, notices, error rows, and footer rows live inside the
same scroll owner as event or list rows. Nested vertical scrollers between the
tab root and `[data-scroll-owner]` are forbidden.

## Form Tabs

Form tabs use `.form-tab` with `overflow: auto` on the tab root when the whole
panel is the tool surface.

| Tab kind        | Tab root class                |
| --------------- | ----------------------------- |
| New Tab         | `.form-tab` / `.new-tab`      |
| Settings        | `.form-tab` / `.settings-tab` |
| Relay Settings  | `.form-tab` / `.settings-tab` |
| Stats           | `.form-tab` / `.settings-tab` |
| Welcome         | `.form-tab` / `.settings-tab` |
| Upload Settings | `.form-tab` / `.data-tab`     |
| Accounts        | `.form-tab` / `.data-tab`     |
| Tweet           | `.form-tab`                   |
| Profile Edit    | `.form-tab` / `.data-tab`     |
| Mine npub       | `.form-tab`                   |
| Public Chat     | `.form-tab`                   |
| lkjstr Log      | `.data-tab`                   |

## Pane Body

`.pane-body` and `.lkjstr-pane-body` never scroll. They use `overflow: hidden`
and `min-height: 0`. Only the active tab inner root scrolls.

## Tokens

All scroll roots share:

```css
--scroll-track-edge: var(--space-2);
--scroll-content-inset: var(--space-3);
```

Feed virtual lists apply track edge on `.event-list__scroller` and content
inset on `.feed-scroll-item`. Form tabs apply both tokens on the tab root.

## Related

- [feed-shell.md](feed-shell.md).
- [../scroll-layout.md](../scroll-layout.md).
- [../tab-shell-layout.md](../tab-shell-layout.md).
- [../scroll-surface-audit.md](../scroll-surface-audit.md).
