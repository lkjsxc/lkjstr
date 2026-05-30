# Custom Request

## Purpose

Custom Request lets users run validated user-controlled relay reads.

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
- App policy clamps effective relay filter limits to `500` before any stricter
  per-relay NIP-11 clamp is applied.
- The surface shows user input and effective outbound filters separately when a
  filter limit is clamped by app policy or NIP-11 metadata.
- Results are sorted event rows with duplicate relay provenance merged. They do
  not render in relay arrival order.
- Requests with `ids`, `search`, or exact lookup semantics use exact request
  mode.
- Requests whose filters are safely time-windowable event-list filters may use
  adaptive grouped scan mode.
- Adaptive mode preserves user `since` and `until` by intersecting them with the
  scanner segment bounds.
- Adaptive mode never displays rows outside user filter bounds or scanner
  segment bounds.
- Custom Request cache keys include normalized relay URLs, normalized filter
  JSON, page size, and request mode.
- Results render through the shared event row surface and automatic row-anchor
  restore.
- Request JSON and whether the request has run are preserved in feed
  `filterState` for tab switch and reload restore.
- Scroll position restores per Custom Request tab after tab switching and
  reload.
- Invalid JSON or invalid request shapes stay local and are not sent to relays.
