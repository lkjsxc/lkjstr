# Scroll Surface Audit

## Purpose

This checklist tracks scrollbar placement and content inset per scrolling
surface. Each row must pass before the scroll-layout contract is complete.

## Checklist

| Surface         | Scroll root                       | Track at tile edge | Content inset on child | Status   |
| --------------- | --------------------------------- | ------------------ | ---------------------- | -------- |
| Home / Global   | `.event-list__viewport`           | required           | required               | required |
| Oversized Home / Global event | `.event-list__viewport` | required | required | required |
| Thread          | `.event-list__viewport`           | required           | required               | required |
| Oversized Thread root | `.event-list__viewport`      | required           | required               | required |
| Oversized Thread reply | `.event-list__viewport`     | required           | required               | required |
| Search          | `.event-list__viewport`           | required           | required               | required |
| Oversized Search result | `.event-list__viewport`    | required           | required               | required |
| Profile         | `.event-list__viewport`           | required           | required               | required |
| Oversized Profile note | `.event-list__viewport`     | required           | required               | required |
| Notifications   | `.notification-list-scroll`       | required           | required               | required |
| Oversized notification referenced event preview | `.notification-list-scroll` | required | required | required |
| Long unbroken text or URL | feed scroll root           | required           | required               | required |
| Split-pane resize after narrow measurement | feed scroll root | required           | required               | required |
| Settings        | `.settings-tab`                   | required           | required               | required |
| Relay Settings  | `.settings-tab`                   | required           | required               | required |
| Stats           | `.settings-tab`                   | required           | required               | required |
| Welcome         | `.settings-tab`                   | required           | required               | required |
| Upload Settings | `.settings-tab`                   | required           | required               | required |
| Custom Request  | tab scroll root                   | required           | required               | required |
| Author Context  | tab scroll root                   | required           | required               | required |
| lkjstr Log      | tab scroll root                   | required           | required               | required |
| Pane shell      | no inline padding on `.pane-body` | n/a                | tab inner roots        | required |

## Additional Checks

| Check                                                                   | Applies to                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| No nested vertical `overflow: auto` between `.feed-tab` and scroll root | Feed tabs                                            |
| Event More menu clears scrollbar track                                  | Home, Global, Search, Profile, Thread, Notifications |
| One bottom border between adjacent notification items                   | Notifications                                        |
| No horizontal overflow on `[data-scroll-owner]`                         | All feed scroll roots                                |
| Oversized semantic events become real visual fragments, not nested scroll | Home, Global, Profile, Thread, Search, Notifications |
| Width-bucket resize can shrink stale narrow measurements                 | All virtual feed scroll roots                        |

## Verification

- Scrolling element `getBoundingClientRect().right` aligns with pane body right
  edge within one device pixel.
- Text in the rightmost column does not sit under the scrollbar thumb.
- `scrollbar-gutter: stable` prevents layout shift when scrollbars appear.
- Feed tabs use `.feed-tab` with exactly one `[data-scroll-owner]`.
- Long-content cases pass the regression list in
  [scroll-regression-tests.md](../data/feed-surface/scroll-regression-tests.md).

## Related

- [feed-scroll-surface.md](../data/feed-surface/feed-scroll-surface.md).
- [feed-row-chrome.md](../data/feed-surface/feed-row-chrome.md).
- [tab-shell-layout.md](tab-shell-layout.md).
- [scroll-layout.md](scroll-layout.md): tokens and contract.
