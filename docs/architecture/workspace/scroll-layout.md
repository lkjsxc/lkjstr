# Scroll Layout

## Purpose

Scroll layout keeps long content readable when scrollbars sit at the tile edge
without overlapping text or controls.

## Contract

- The **scrolling element** for each surface owns `scrollbar-gutter: stable`.
- `--scroll-track-edge` is the distance from the tile inner border to the
  scrollbar track (default `0`). Feed tabs keep this gap tight so the scrollbar
  sits close to split resize handles without covering row controls.
- `--scroll-content-inset` (default `var(--space-3)`) pads direct content
  children on the inline end so text does not sit under the thumb.
- Home and Global reset the direct `.event-list` child inset so their Virtua
  scrollbar aligns with the Notifications scroll position instead of being
  pushed inward twice.
- New Tab keeps the chooser scroll root inset from the pane edge with an
  inline-end margin because the tab root itself owns vertical scrolling.
- `.pane-body` does not add inline padding on the scroll axis. Block-axis
  padding may remain for vertical rhythm.
- Feed virtual lists keep status rows inside the scroll flow so the footer moves
  with content.
- Profile summary and note rows share the same feed scroll owner so the summary
  scrolls away with the notes.
- Horizontal overflow in pane bodies is forbidden except for intentional rails
  such as the tab strip.
- Feed scroll roots use `overflow-x: clip`.
- Event More menu uses `right: var(--scroll-content-inset)` and `.event-main`
  reserves the same inline-end padding.
- Feed tabs use `.feed-tab` with a single `[data-scroll-owner]` child per
  [tab-shell-layout.md](tab-shell-layout.md).

## Tokens

```css
--scroll-track-edge: 0px;
--scroll-content-inset: var(--space-3);
```

Apply `padding-inline-end: var(--scroll-content-inset)` on inner content
wrappers listed in `scroll-layout.css`; apply the track edge as the scroll
owner's inline-end padding only when a surface needs extra clearance.

## Surfaces

| Surface                                                   | Scrolling element                          | Content wrapper      |
| --------------------------------------------------------- | ------------------------------------------ | -------------------- |
| Home, Global, Thread, Search, Profile                     | Virtua viewport in `.event-list__scroller` | `.feed-scroll-item`  |
| Notifications                                             | `.notification-list-scroll`                | `.feed-scroll-item`  |
| Settings, Relay Settings, Stats, Welcome, Upload Settings | `.settings-tab`                            | `.settings-tab > *`  |
| Custom Request, Author Context, lkjstr Log                | Tab-specific scroll root (see tab CSS)     | tab CSS              |
| Pane tab shell                                            | `.pane-body` (non-scrolling container)     | tab root inside body |

`.pane-body` and `.event-list__scroller` wrappers may use `overflow: hidden`
while the Virtua or tool child owns vertical scroll.

Per-surface checklist: [scroll-surface-audit.md](scroll-surface-audit.md).

## Marking Scroll Owners

Tab bodies set `data-scroll-owner` on the primary vertical scroller so tab
retention can capture `scrollTop` without scanning arbitrary descendants.

Virtua feed lists use the Virtua viewport element inside `.event-list__scroller`.
Profile leading rows use the same viewport and content wrapper as note rows.

## Related

- [feed-scroll-surface.md](../data/feed-surface/feed-scroll-surface.md): shared
  scroll component.
- [feed-row-chrome.md](../data/feed-surface/feed-row-chrome.md): row separators
  and control inset.
- [tab-shell-layout.md](tab-shell-layout.md): feed-tab vs form-tab.
- [scroll-surface-audit.md](scroll-surface-audit.md): per-surface checklist.
- [tab-retention-flow.md](tab-retention-flow.md): scroll capture on blur.
- [tab-runtime.md](tab-runtime.md): snapshot fields.
