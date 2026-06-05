# NIP-89 Client Tag

## Purpose

This file defines lkjstr support for NIP-89 application handlers and the
optional client information tag on authored events.

## Contract

NIP-89 defines application handler recommendation events at kind `31989` and
handler information events at kind `31990`. It also defines an optional event
tag shaped like:

```json
["client", "lkjstr", "31990:<hex-pubkey>:<identifier>", "wss://relay.example"]
```

lkjstr emits a `client` tag only before signing, because tags are part of the
event id and signature. It never adds the tag after signing.

## Privacy

Client tags reveal software choice and may reveal a relay hint. Users must be
able to opt out. The default setting is disabled unless a valid handler
coordinate and relay hint are configured or produced by a real user-signed
handler-information event.

## Allowed Targets

When enabled and valid, client tags may be added to public user-authored events
such as notes, replies, reactions, reposts, profile metadata updates, public
chat messages, and NIP-29 group messages.

## Forbidden Targets

Client tags are not added to:

- NIP-98 HTTP auth events.
- NIP-42 relay auth events.
- Blossom auth events.
- Future encrypted-message envelopes.
- Private local events.
- Any event where the tag would leak sensitive context.
- Any event when the user has opted out.

## Validation

- Name is trimmed and must be non-empty.
- Address must be `31990:<hex-pubkey>:<identifier>`.
- The pubkey segment must be lowercase or uppercase hex and exactly 64
  characters after normalization.
- Identifier is trimmed and must be non-empty.
- Relay hint must normalize through the relay URL normalizer and use an accepted
  relay URL scheme.
- Malformed settings produce no tag and surface validation feedback. lkjstr must
  not fabricate handler addresses.

## Settings

Client-tag settings live in the flat Settings list:

- `publish.clientTag.enabled`: boolean, default `false`.
- `publish.clientTag.name`: string, default `lkjstr`.
- `publish.clientTag.address`: string, default empty.
- `publish.clientTag.relay`: string, default empty.
- `timeline.showClientTags`: boolean, default `false`.

## Status

Status: partial. Rust validation and tag building are the first implemented
slice. Publishing integration and opt-out UI remain active until shipped public
write paths add valid tags before signing and tests prove sensitive exclusions.
