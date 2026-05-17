Owner: Product
State: Canon

# Deck

## Purpose

The deck is the primary product surface.

## Deck Contract

- A deck is a browser workspace made of tiles.
- A tile is an independently configured Nostr view.
- Initial tiles are timeline, custom filter, relay monitor, and composer.
- Later tiles must register through the tile registry before rendering.
- Deck layout persists locally.
- Tile state is separate from relay connection state.
- Closing a tile releases subscriptions owned by that tile.
- Reordering and resizing tiles must not recreate unrelated subscriptions.
- Small screens use focused tile navigation instead of horizontal crowding.

## User Actions

- Create a deck.
- Rename a deck.
- Add a tile.
- Remove a tile.
- Duplicate a tile.
- Reorder tiles.
- Resize tiles.
- Configure tile relays and filters.
- Open raw event details.
- Open relay diagnostics.

## Acceptance

- A user can create a deck with three timeline tiles.
- Each tile can use different filters.
- Layout survives reload.
- The deck remains usable with ten active tiles.
