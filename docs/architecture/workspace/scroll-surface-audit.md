# Scroll Surface Audit

## Purpose

This checklist tracks scrollbar placement and content inset per scrolling
surface. Each row must pass before the scroll-layout contract is complete.

## Audit Status Legend

| Value         | Meaning                                             |
| ------------- | --------------------------------------------------- |
| `implemented` | Verified against the scroll-layout contract         |
| `open`        | Contract required; verification or fix still active |

## Checklist

| Surface                                         | Scroll root                       | Shared track inset | Content inset on child | Audit status |
| ----------------------------------------------- | --------------------------------- | ------------------ | ---------------------- | ------------ |
| Home / Global                                   | `.event-list__viewport`           | required           | required               | implemented  |
| Oversized Home / Global event                   | `.event-list__viewport`           | required           | required               | implemented  |
| Thread                                          | `.event-list__viewport`           | required           | required               | implemented  |
| Oversized Thread root                           | `.event-list__viewport`           | required           | required               | implemented  |
| Oversized Thread reply                          | `.event-list__viewport`           | required           | required               | implemented  |
| Search                                          | `.event-list__viewport`           | required           | required               | implemented  |
| Oversized Search result                         | `.event-list__viewport`           | required           | required               | implemented  |
| Profile                                         | `.event-list__viewport`           | required           | required               | implemented  |
| Followees                                       | `.event-list__viewport`           | required           | required               | implemented  |
| User Timeline                                   | `.event-list__viewport`           | required           | required               | implemented  |
| Oversized Profile note                          | `.event-list__viewport`           | required           | required               | open         |
| Notifications                                   | `.event-list__viewport`           | required           | required               | implemented  |
| Oversized notification referenced event preview | `.event-list__viewport`           | required           | required               | open         |
| Long unbroken text or URL                       | feed scroll root                  | required           | required               | open         |
| Split-pane resize after narrow measurement      | feed scroll root                  | required           | required               | open         |
| Tab kind switch in same pane                    | feed and form scroll roots        | required           | required               | implemented  |
| Settings                                        | `.settings-tab.form-tab`          | required           | required               | implemented  |
| Relay Settings                                  | `.relay-settings.form-tab`        | required           | required               | implemented  |
| Stats                                           | `.stats-tab.form-tab`             | required           | required               | implemented  |
| Welcome                                         | `.welcome-tab.form-tab`           | required           | required               | implemented  |
| Upload Settings                                 | `.upload-settings-tab.form-tab`   | required           | required               | implemented  |
| Custom Request                                  | `.event-list__viewport`           | required           | required               | implemented  |
| Author Context                                  | `.event-list__viewport`           | required           | required               | implemented  |
| lkjstr Log                                      | `.relay-monitor.form-tab`         | required           | required               | implemented  |
| Pane shell                                      | no inline padding on `.pane-body` | n/a                | tab inner roots        | implemented  |

## Additional Checks

| Check                                                                     | Applies to                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| No nested vertical `overflow: auto` between `.feed-tab` and scroll root   | Feed tabs                                            |
| Event More menu clears scrollbar track                                    | Home, Global, Search, Profile, Thread, Notifications |
| One bottom border between adjacent notification items                     | Notifications                                        |
| No horizontal overflow on `[data-scroll-owner]`                           | All feed scroll roots                                |
| Oversized semantic events become real visual fragments, not nested scroll | Home, Global, Profile, Thread, Search, Notifications |
| Width-bucket resize can shrink stale narrow measurements                  | All virtual feed scroll roots                        |
| Unload or dematerialization preserves measured reservation                | All row-like scroll roots                            |
| Repost targets use shared event rendering and geometry                    | Home, Global, Search, Profile, Thread, Notifications |

## Verification

- Scrolling element `getBoundingClientRect().right` is inset from the pane body
  right edge by `--scroll-track-edge` within one device pixel.
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
- [ui-system/scroll-inset-ownership.md](ui-system/scroll-inset-ownership.md).
