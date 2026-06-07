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

Form tabs use `.form-tab` with one inner `.tab-scroll-owner.form-tab__scroll`;
the tab root itself remains non-scrolling.

| Tab kind        | Tab root class                  | Scroll root                          |
| --------------- | ------------------------------- | ------------------------------------ |
| New Tab         | `.form-tab` / `.new-tab`        | `.tab-scroll-owner.form-tab__scroll` |
| Settings        | `.form-tab` / `.settings-tab`   | `.tab-scroll-owner.form-tab__scroll` |
| Relay Settings  | `.form-tab` / `.relay-settings` | `.tab-scroll-owner.form-tab__scroll` |
| Stats           | `.form-tab` / `.stats-tab`      | `.tab-scroll-owner.form-tab__scroll` |
| Welcome         | `.form-tab` / `.welcome-tab`    | `.tab-scroll-owner.form-tab__scroll` |
| Upload Settings | `.form-tab` / `.data-tab`       | `.tab-scroll-owner.form-tab__scroll` |
| Accounts        | `.form-tab` / `.data-tab`       | `.tab-scroll-owner.form-tab__scroll` |
| Tweet           | `.form-tab`                     | `.tab-scroll-owner.form-tab__scroll` |
| Profile Edit    | `.form-tab` / `.data-tab`       | `.tab-scroll-owner.form-tab__scroll` |
| Mine npub       | `.form-tab`                     | `.tab-scroll-owner.form-tab__scroll` |
| Public Chat     | `.form-tab`                     | `.tab-scroll-owner.form-tab__scroll` |
| lkjstr Log      | `.form-tab` / `.relay-monitor`  | `.tab-scroll-owner.form-tab__scroll` |

## Pane Body

`.pane-body` and `.lkjstr-pane-body` never scroll. They use `overflow: hidden`
and `min-height: 0`. Only the active tab inner root scrolls.

## Tokens

All scroll roots share:

```css
--scroll-track-edge: var(--space-2);
--scroll-content-inset: var(--space-3);
```

Feed virtual lists and form tabs apply track edge on `.tab-scroll-track` and
content inset on `.feed-scroll-item` or direct `.form-tab__scroll` children.

## Related

- [feed-shell.md](feed-shell.md).
- [../scroll-layout.md](../scroll-layout.md).
- [../tab-shell-layout.md](../tab-shell-layout.md).
- [../scroll-surface-audit.md](../scroll-surface-audit.md).
