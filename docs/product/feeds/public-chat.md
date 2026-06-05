# Public Chat

## Purpose

Public Chat defines the user-visible NIP-28 channel chat workspace surface.

## Scope

Public Chat is a workspace tab opened from New Tab. It shows real NIP-28
channels and messages only. It does not show mock channels, mock messages,
fake counters, fake relay support, generated sample content, or placeholder
success states.

## Visible States

- No read relays are selected.
- Channel discovery is loading.
- A real channel list is available.
- No channels were found and relay coverage is incomplete.
- A selected channel is loading messages.
- A selected channel has no loaded messages, with coverage status visible.
- Composer is disabled because no signing account is active.
- Composer is disabled because no enabled write relays are available.
- Publish has been signed locally and queued.
- Relay publish results are partial.
- Channel metadata is unavailable.

## Supported Actions

- Discover channels from real kind `40` events.
- Open a channel by channel creation event id.
- Create a channel by publishing kind `40`.
- Edit channel metadata by publishing kind `41` when the active account owns the
  channel creation event.
- Send a root channel message by publishing kind `42`.
- Send a reply by publishing kind `42` with root and reply tags.
- Hide a message by publishing kind `43`.
- Mute a user by publishing kind `44`.

## Channel List

- Channels are derived from kind `40` creation events and kind `41` metadata
  updates.
- The list is newest meaningful activity first.
- Metadata relay hints are shown only when they came from real metadata.
- Missing metadata renders a compact unavailable state instead of generated
  values.
- Relay coverage is visible. Incomplete coverage never proves that a channel
  does not exist.

## Selected Channel

- Messages are real kind `42` events for the selected channel.
- Chat order is deterministic and oldest first.
- Reply context comes from real tags and loaded real events.
- Missing reply targets render compact unavailable context.
- Hidden messages remain as compact hidden rows so ordering and pagination stay
  stable.
- Muted authors render compact muted rows unless a real reveal preference is
  implemented and documented.

## Composer

- The composer signs through the active local signer or NIP-07 account path.
- Publishing targets enabled write relays in the selected write set, plus
  bounded channel relay hints when allowed.
- Message text clears after local signing and queueing, not after relay OKs.
- Publish failure state is diagnostic and distinguishes local signing failure,
  no write relays, and partial relay rejection.

## Related

- [../../protocol/public-chat.md](../../protocol/public-chat.md).
- [../../architecture/runtimes/public-chat-runtime.md](../../architecture/runtimes/public-chat-runtime.md).
- [../../architecture/feeds/sources/public-chat.md](../../architecture/feeds/sources/public-chat.md).
