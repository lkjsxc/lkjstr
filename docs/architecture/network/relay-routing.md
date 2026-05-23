# Relay Routing

## Purpose

Relay routing lets browser runtimes find targeted events without importing
relays into Relay Settings or relying on a backend proxy.

## Sources

- Selected read relays are always the base and fallback.
- NIP-65 kind `10002` `r` tags add author read or write routes.
- NIP-02 kind `3` `p` tag relay hints add followed-author routes.
- `nevent`, `naddr`, `e`, and `q` tag relay hints add event lookup routes.
- Event relay receipts add local evidence for exact event and author routes.
- Discovery relays are only used for kind `0`, `3`, and `10002` metadata
  discovery.

## Priority

1. Entity and tag relay hints.
2. Event relay receipts.
3. NIP-65 author routes for the requested purpose.
4. NIP-02 follow hints.
5. Selected read relays.
6. Discovery relays for metadata discovery only.

## Bounds

- Use at most `4` route relays per author.
- Use at most `12` route groups per operation.
- Use at most `50` authors in an author-specific group.
- Use at most `200` authors in a selected fallback filter.
- Historical pages use interval windows and include both `since` and `until`.
- `limit` is a safety cap and must never be `0`.

## Blocks

Disabled or removed relay URLs are globally blocked after normalization. Route
planning excludes blocked URLs until the user re-adds or enables the same URL.
Blocks do not delete cached events or relay receipts.

## Discovery Relays

The default discovery relays are:

- `wss://purplepag.es/`
- `wss://user.kindpag.es/`
- `wss://directory.yabu.me/`

Discovery results are runtime route evidence. They do not silently change Relay
Settings and do not overwrite disabled relay records.

## Non-Goals

- No server-side relay proxy.
- No mock content for missing events.
- No automatic Relay Settings import from NIP-65 data.
- No Global feed expansion beyond the selected readable relay set, except
  shared diagnostics and NIP-11 request shaping.
