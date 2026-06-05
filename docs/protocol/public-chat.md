# Public Chat Protocol

## Purpose

This contract defines the Nostr public chat protocol surface used by the
workspace Public Chat tab.

## Protocol Choice

The implemented Public Chat protocol is NIP-28 channel chat. NIP-28 is marked
as not recommended by the Nostr NIP text in favor of NIP-29, but NIP-29 uses a
relay-local group model and is not implemented unless real code, tests, docs,
and UI for that model land in the same change.

## Supported Event Kinds

- Kind `40`: channel creation.
- Kind `41`: channel metadata.
- Kind `42`: channel message.
- Kind `43`: hide message.
- Kind `44`: mute user.

## Event Interpretation

- Channel identity is the event id of the kind `40` channel creation event.
- Channel creation content is a JSON object with optional `name`, `about`,
  `picture`, and `relays` fields.
- Channel metadata uses kind `41` events that reference the channel creation
  event with an `e` tag.
- Newest valid metadata wins. Ties use lexical event id order so all clients can
  reach the same view.
- Channel messages are kind `42` events that reference the channel root with an
  `e` tag.
- Root messages use an `e` tag with marker `root` when available.
- Replies keep the root channel tag and add reply message tags using the NIP-28
  root and reply shape.
- Hide message actions are signed kind `43` events. The app does not invent
  fake moderation state.
- Mute user actions are signed kind `44` events. The app does not invent fake
  user moderation state.

## Metadata Policy

- `name` is trimmed, bounded text. Empty values mean unavailable metadata.
- `about` is bounded text. Empty values are omitted from rendered summaries.
- `picture` may render as an image only when it is an HTTPS URL.
- `relays` is an array of relay URLs. Valid entries are normalized with the
  shared relay URL rules. Invalid entries are ignored with diagnostics when the
  caller records diagnostics.
- Unknown fields are ignored.
- Non-object JSON content is invalid. Empty content is treated as an empty
  object only where the event kind allows absent metadata.

## Relay Behavior

- Selected read relays are the default channel discovery and message source.
- Channel metadata relay hints are bounded targeted routes only.
- Disabled or removed relays are not queried or overwritten by metadata hints.
- Selected write relays are the default publish targets.
- Channel relay hints may add bounded write targets when enabled by relay
  policy and not disabled by the user.
- Partial relay failure is diagnostic and must not block reachable relays.
- Missing results from incomplete relay coverage never prove absence.

## Related

- [nip-support.md](nip-support.md).
- [relays.md](relays.md).
- [../product/feeds/public-chat.md](../product/feeds/public-chat.md).
