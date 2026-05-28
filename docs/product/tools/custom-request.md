# Custom Request

## Purpose

Custom Request lets users run one-shot relay reads from validated JSON.

## Accepted JSON

- A single filter object.
- An array of filter objects.
- A request object with `filters` and optional `relays`.
- A Nostr client message shaped as `["REQ", subId, ...filters]`.

## Contract

- Custom Request opens from New Tab.
- Requests use selected default read relays unless the JSON supplies `relays`.
- Relay URLs must pass the shared relay URL normalizer.
- JSON input above `64 KiB` is rejected before parsing.
- A request may include at most `8` filters and `32` explicit relays.
- Filter `ids`, `authors`, and tag value arrays are capped at `500` values.
- Search strings are capped at `256` bytes.
- Effective relay filter limits are clamped to `500`.
- Results are sorted event rows with duplicate relay provenance merged. They do
  not render in relay arrival order.
- Results render through the shared event row surface and automatic row-anchor
  restore.
- Request JSON and whether the request has run are preserved in feed
  `filterState` for tab switch and reload restore.
- Scroll position restores per Custom Request tab after tab switching and
  reload.
- Invalid JSON or invalid request shapes stay local and are not sent to relays.
