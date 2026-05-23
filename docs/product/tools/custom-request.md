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
- Results are sorted event rows with duplicate relay provenance merged. They do
  not render in relay arrival order.
- Results render through the shared event row surface.
- Invalid JSON or invalid request shapes stay local and are not sent to relays.
