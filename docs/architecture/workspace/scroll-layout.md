# Scroll Layout

## Purpose

Scroll layout keeps long content readable while scrollbar tracks stay slightly
inset from split handles and do not overlap text or controls.

## Contract

- The **scrolling element** for each surface owns `scrollbar-gutter: stable`.
- The tab root also reserves the same platform gutter: `.feed-tab` and
  `.form-tab` both set `scrollbar-gutter: stable` even though the root itself
  does not scroll. This keeps form tabs such as New Tab and Relay Settings in
  the same horizontal position as Home and Notifications.
- `--scroll-track-edge` is the distance from the tile inner border to the
  scrollbar track (default `var(--space-2)`). Feed and tool tabs use the same
  token so scrollbar tracks do not sit flush against split resize handles.
- `--scroll-content-inset` (default `var(--space-3)`) pads direct content
  children on the inline end so text does not sit under the thumb.
- `FeedScrollSurface` and `FormTabShell` stamp the shared `.tab-scroll-track`
  wrapper and `.tab-scroll-owner` scroll host. Home, Global, Thread, Search,
  Profile, Notifications, Followees, User Timeline, Custom Request, Author
  Context, New Tab, Relay Settings, and every tool tab therefore use the same
  scrollbar inset.
- Tool-style tab scroll roots (`.data-tab`, `.settings-tab`, `.new-tab`,
  `.relay-monitor`, and `.relay-settings`) use the same padded wrapper rather
  than per-tab margins.
- `.pane-body` does not add inline padding on the scroll axis. Block-axis
  padding may remain for vertical rhythm.
- The scroll owner is the layout root for vertical movement. It is not the
  semantic owner of one feed event or one product row.
- Feed virtual lists keep status rows inside the scroll flow so the footer moves
  with content.
- Feed rows preserve reserved height when they unload, dematerialize, or switch
  to shells; only legitimate remeasurement may shrink a row per
  [unload-height-stability.md](../data/feed-surface/unload-height-stability.md).
- Oversized semantic events may produce multiple real visual rows in the same
  scroll flow. The fragments preserve event identity, content, provenance,
  ordering, and actions per
  [long-content.md](../data/feed-surface/long-content.md).
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
--scroll-track-edge: var(--space-2);
--scroll-content-inset: var(--space-3);
```

Apply `padding-inline-end: var(--scroll-content-inset)` on inner content
wrappers listed in `scroll-layout.css`; apply the track edge to the shared feed
scroller wrapper or to a tool root margin so the scroll owner itself moves away
from split handles.

## Surfaces

| Surface                                                   | Scrolling element                        | Content wrapper      |
| --------------------------------------------------------- | ---------------------------------------- | -------------------- |
| Home, Global, Thread, Search, Profile                     | `.tab-scroll-owner.event-list__viewport` | `.feed-scroll-item`  |
| Notifications                                             | `.notification-list-scroll`              | `.feed-scroll-item`  |
| Settings, Relay Settings, Stats, Welcome, Upload Settings | `.form-tab__scroll.tab-scroll-owner`     | root direct children |
| Custom Request, Author Context, lkjstr Log                | shared feed or form scroll owner         | root direct children |
| Pane tab shell                                            | `.pane-body` (non-scrolling container)   | tab root inside body |

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
- [long-content.md](../data/feed-surface/long-content.md): oversized event
  visual fragments.
- [geometry-model.md](../data/feed-surface/geometry-model.md): row reservations,
  estimates, and anchor compensation.
- [unload-height-stability.md](../data/feed-surface/unload-height-stability.md):
  preserved height for unloaded and dematerialized rows.
- [feed-row-chrome.md](../data/feed-surface/feed-row-chrome.md): row separators
  and control inset.
- [tab-shell-layout.md](tab-shell-layout.md): feed-tab vs form-tab.
- [scroll-surface-audit.md](scroll-surface-audit.md): per-surface checklist.
- [tab-retention-flow.md](tab-retention-flow.md): scroll capture on blur.
- [tab-runtime.md](tab-runtime.md): snapshot fields.
