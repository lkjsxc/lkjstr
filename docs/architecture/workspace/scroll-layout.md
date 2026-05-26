# Scroll Layout

## Purpose

Scroll layout keeps long content readable when scrollbars consume width or
overlay content.

## Contract

- Feed list scrollers, pane tab bodies, settings panes, and other long tool
  surfaces use `scrollbar-gutter: stable` on the scrolling element.
- Overlay scrollbars still require content-safe inline padding on the scrolling
  element or its inner content wrapper so text and controls do not sit under the
  visible scrollbar thumb.
- Feed virtual lists keep status rows inside the scroll flow so the footer moves
  with content.
- Horizontal overflow in pane bodies is forbidden except for intentional rails
  such as the tab strip.

## Surfaces

| Surface                                                    | Scrolling element       |
| ---------------------------------------------------------- | ----------------------- |
| Home, Global, Thread, Search, Profile notes, Notifications | `.event-list__scroller` |
| Settings, Relay Settings, Stats, Welcome                   | Pane tab body root      |
| lkjstr Log                                                 | Log list container      |
