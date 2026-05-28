# Author Context

## Purpose

Author Context shows nearby posts by an event author around an anchor event.

## Contract

- Author Context opens from an event row menu in the same tile.
- The view loads the anchor event and nearby cached or relay-backed events by
  the same author.
- Nearby relay pages use compound cursor boundaries and merge duplicate relay
  provenance before rendering.
- Rows render through the shared event row surface, footer phase, and automatic
  row-anchor restore.
- Scroll position restores per Author Context tab after tab switching and
  reload.
- The surface is action-opened; it is not a New Tab choice.
- The event row menu also exposes event id copy actions.
