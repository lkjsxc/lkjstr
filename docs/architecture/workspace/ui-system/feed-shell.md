# Feed Shell

## Purpose

Feed shell defines the shared layout contract for vertically scrolling feed and
list tabs inside split panes.

## Tab Root

Feed tabs use:

```text
.feed-tab
```

Required properties on the tab root:

- `overflow: hidden`
- `height: 100%`
- `min-height: 0`
- `min-width: 0`

Feed tab class names:

| Tab                            | Root classes                  |
| ------------------------------ | ----------------------------- |
| Home, Global                   | `.timeline-tab.feed-tab`      |
| Search                         | `.timeline-tab.feed-tab`      |
| Profile                        | `.profile-tab.feed-tab`       |
| Thread, Notifications          | `.feed-tab`                   |
| Followees                      | `.followees-tab.feed-tab`     |
| User Timeline                  | `.user-timeline-tab.feed-tab` |
| Custom Request, Author Context | `.hybrid-tab.feed-tab`        |

## Scroll Owner

- Exactly one child owns vertical scroll.
- That child sets `data-scroll-owner`.
- `.pane-body` never scrolls; it remains `overflow: hidden`.
- Feed virtual lists scroll inside `.event-list__viewport` or the documented
  notification scroll root.

## Scrollbar Inset

All feed scroll roots share:

```css
--scroll-track-edge: var(--space-2);
--scroll-content-inset: var(--space-3);
```

The scroller wrapper applies the track edge. `.feed-scroll-item` applies the
content inset so thumbs do not overlap text. Feed tab roots must not add
horizontal padding. See [scroll-inset-ownership.md](scroll-inset-ownership.md).

## Leading Rows

Profile summary rows, User Timeline identity headers, Followees identity
headers, notices, and footer rows live inside the same scroll owner as event
rows. Nested vertical scrollers between the tab root and the scroll owner are
forbidden.

## Hybrid Tabs

Custom Request and Author Context use `.hybrid-tab.feed-tab` with a fixed
toolbar and one feed scroll owner. See
[hybrid-tab-shells.md](hybrid-tab-shells.md).

## Form Tabs

Settings, Relay Settings, Stats, Welcome, Upload Settings, Accounts, Tweet,
Profile Edit, Mine npub, New Tab, and Public Chat require `.form-tab` on the tab
root. See [scroll-alignment.md](scroll-alignment.md).

## Split Panes

Scrollbar track position must match when switching feed and form tabs in the
same pane. See [scroll-alignment.md](scroll-alignment.md).

## Related

- [scroll-inset-ownership.md](scroll-inset-ownership.md).
- [../tab-shell-layout.md](../tab-shell-layout.md).
- [../scroll-layout.md](../scroll-layout.md).
- [../scroll-surface-audit.md](../scroll-surface-audit.md).
- [../../data/feed-surface/feed-scroll-surface.md](../../data/feed-surface/feed-scroll-surface.md).
