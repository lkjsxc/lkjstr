# Relay Routing

## Purpose

Relay routing lets browser runtimes find targeted events without importing
relays into Relay Settings or relying on a backend proxy.

Per-surface routing tables live in
[subscription-orchestration/routing-by-surface.md](subscription-orchestration/routing-by-surface.md).
The orchestrator applies those tables when building Demand relay lists.

## Sources

- Selected user read relays are always the base and fallback.
- NIP-65 kind `10002` `r` tags add author read or write routes.
- NIP-02 kind `3` `p` tag relay hints add followed-author routes.
- `nevent`, `naddr`, `e`, and `q` tag relay hints add event lookup routes.
- Event relay receipts add local evidence for exact event and author routes.
- Enabled discovery relays are only used for metadata and relay-list metadata
  discovery.

## Priority

1. Entity and tag relay hints.
2. Event relay receipts.
3. NIP-65 author routes for the requested purpose.
4. NIP-02 follow hints.
5. Selected read relays.
6. Discovery relays for metadata and relay-list metadata discovery only.

## Bounds

- Use at most `4` route relays per author.
- Use at most `12` targeted author route groups per operation.
- Use at most `50` authors in an author-specific group.
- Selected fallback groups are mandatory base coverage whenever any selected
  relays survive normalization and block filtering. They are appended after
  targeted author groups and are not counted against the targeted group cap.
- Use at most `200` authors in a selected fallback filter. Large follow lists
  are chunked into as many selected fallback groups as needed.
- Discovery groups are appended after selected fallback groups only when
  discovery is requested, and discovery-purpose blocks are excluded.
- Home, Profile, and Global historical pages use adaptive bounded windows with
  both `since` and `until`; sparse complete windows continue scanning older.
- Grouped feed routing cannot widen adaptive scanner windows. Dispatch applies
  the scanner-owned `since` and `until` bounds after route-specific filters are
  built.
- `limit` is a safety cap and must never be `0`.
- Request purposes are `feed`, `metadata`, `event-lookup`, `route-discovery`,
  and `search`.
- Cached NIP-11 `limitation.max_limit` caps relay request limits per relay
  group while final page slicing stays local.
- A relay-effective NIP-11-capped limit below the requested page size is still
  dense when the relay returns that many matching candidates.
- Search uses relays known to support NIP-50 plus relays with unknown support.
  Relays known not to support NIP-50 are skipped for search requests.
- Unknown NIP-11 data is not treated as lack of support.

## Blocks

Disabled or removed relay URLs are blocked for the affected relay purpose after
normalization. User-purpose blocks exclude URLs from feed, content, write, and
selected-relay planning. Discovery-purpose blocks exclude URLs from discovery
planning only. Blocks do not delete cached events or relay receipts.

## Default User Relays

Clean storage seeds the editable `public-default` user set from
[default-relays.md](../../protocol/default-relays.md). Kiri Japan
(`wss://relay-jp.nostr.wirednet.jp`) and Kiri World
(`wss://relay.nostr.wirednet.jp`) are user-purpose defaults, so they may drive
Home, Global, Profile, Thread, Notifications, selected-relay tools, and Tweet
writes when the default set remains selected and the rows stay enabled.

Existing user edits are not widened during normalization. Explicit restore is
the only automatic way to replace the user default set with the current default
relay table.

## Discovery Relays

The editable default discovery relays are seeded into Relay Settings as the
`discovery-default` purpose set on clean storage:

- `wss://purplepag.es/`
- `wss://directory.yabu.me/`

Discovery results are runtime route evidence. They do not silently change Relay
Settings and do not overwrite disabled relay records. Editing discovery relays
does not edit the selected user read or write relay lists.

`wss://user.kindpag.es/` is not a built-in discovery relay. Home, Profile, and
route discovery may contact it only when the user explicitly selects, imports,
and enables that relay.

Bulk author route discovery requests only kind `10002` relay-list metadata and
uses selected user read relays plus enabled discovery relays. Kind `3` relay
hints are stored from observed follow-list events, not broad discovery sweeps.
Feed and content reads exclude discovery-only relays unless the user explicitly
selected or imported and enabled the same relay as a user read relay.

## Non-Goals

- No server-side relay proxy.
- No mock content for missing events.
- No automatic Relay Settings import from NIP-65 data.
- No Global feed expansion beyond the selected readable relay set, except
  shared diagnostics and NIP-11 request shaping.
