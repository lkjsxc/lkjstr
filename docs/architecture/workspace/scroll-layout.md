# Scroll Layout

## Purpose

Scroll layout keeps long content readable when scrollbars consume width or
overlay content.

## Contract

- The **scrolling element** for each surface owns `scrollbar-gutter: stable`.
- Content-safe inline padding uses `--scroll-content-inset` (default
  `var(--space-3)`) on the scrolling element or its direct content wrapper so
  text and controls do not sit under the visible scrollbar thumb.
- Feed virtual lists keep status rows inside the scroll flow so the footer moves
  with content.
- Horizontal overflow in pane bodies is forbidden except for intentional rails
  such as the tab strip.

## Token

```css
--scroll-content-inset: var(--space-3);
```

Apply `padding-inline-end: var(--scroll-content-inset)` on inner content
wrappers listed in `scroll-layout.css`.

## Surfaces

| Surface                                                    | Scrolling element                          |
| ---------------------------------------------------------- | ------------------------------------------ |
| Home, Global, Thread, Search, Profile notes                | Virtua viewport in `.event-list__scroller` |
| Notifications                                              | `.notification-list-scroll`              |
| Settings, Relay Settings, Stats, Welcome, Upload Settings  | `.settings-tab`                            |
| Custom Request, Author Context, lkjstr Log                 | Tab-specific scroll root (see tab CSS)     |
| Pane tab shell                                             | `.pane-body` (non-scrolling container)     |

`.pane-body` and `.event-list__scroller` wrappers may use `overflow: hidden`
while the Virtua or tool child owns vertical scroll.

## Marking Scroll Owners

Tab bodies set `data-scroll-owner` on the primary vertical scroller so tab
retention can capture `scrollTop` without scanning arbitrary descendants.

## Related

- [tab-retention-flow.md](tab-retention-flow.md): scroll capture on blur.
- [tab-runtime.md](tab-runtime.md): snapshot fields.
