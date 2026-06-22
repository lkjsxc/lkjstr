# Public Chat Runtime

## Purpose

This contract defines ownership, relay demand, storage, bounds, and cleanup for
the Public Chat tab runtime.

## Owner

A Public Chat tab owns one runtime handle. The handle is created when the tab
body mounts and is closed when the tab is closed. Hiding the tab pauses live
relay reads while retaining bounded visible state for fast restore.

## Inputs

- Tab id and workspace id.
- Selected read relay URLs after disabled-relay filtering.
- Selected write relay URLs after disabled-relay filtering.
- Active account pubkey and signer state.
- Optional selected channel id.
- Optional open-by-id channel id.
- Page limits for channel discovery and selected-channel messages.

## Relay Demand Keys

- `public-chat:channels:{readRelayFingerprint}` for channel discovery.
- `public-chat:metadata:{channelId}:{routeFingerprint}` for metadata refresh.
- `public-chat:messages:{channelId}:{routeFingerprint}` for selected-channel
  messages.
- `public-chat:moderation:{accountPubkey}:{channelId}` for own hide and mute
  actions.
- Publish jobs use explicit command ids and do not share live read keys.

Rust now exposes shared `PublicChat` demand builders for channel discovery,
metadata, selected messages, and own moderation reads. TypeScript orchestration
also names `public-chat` and accepts only NIP-28 kinds for that live surface.
Shipped relay execution still remains TypeScript-owned until host/provider
wiring is complete.

## Relay Responsibilities

- Discover channels on selected read relays with kind `40` filters.
- Read metadata with kind `41` filters for known channel ids.
- Read selected-channel messages with kind `42` filters and a bounded limit.
- Read own hide and mute events when an active account exists.
- Add channel metadata relay hints only as bounded targeted routes.
- Exclude disabled or removed relays from every demand.
- Record partial relay failures without blocking successful relays.

## Storage Responsibilities

Public chat events are ordinary Nostr events. The runtime reuses generic event
storage for kinds `40` through `44`, relay provenance, and tag lookup. Product
code must not open browser databases directly.

Typed repositories are allowed only for state not represented by events:

- Opened or pinned channel ids.
- Selected channel id per tab snapshot.
- Composer draft per tab.
- Local display preferences for compact hidden or muted rows, when documented.

## Memory Bounds

- Channel list keeps at most the configured discovery page plus a small selected
  channel pin set.
- Selected-channel messages keep the visible page window, an older-page cursor,
  and compact missing references.
- Diagnostics are deduped by relay, demand key, and reason with a fixed recent
  limit.
- In-flight publish jobs are bounded by active tab ownership and are removed on
  terminal local failure or relay completion timeout.
- Relay hints are deduped and capped before becoming route inputs.

## Cleanup

- Closing the tab cancels live reads, queued older-page reads, timers, relay
  subscriptions, and pending publish waiters owned by the runtime.
- Hiding the tab releases live relay demand and keeps only bounded state.
- Reopening the tab restores from typed tab snapshot state and cached events
  before starting relay reads.
- Cleanup is idempotent.

## Related

- [../network/subscription-orchestration/README.md](../network/subscription-orchestration/README.md).
- [../data/storage/README.md](../data/storage/README.md).
- [../../product/feeds/public-chat.md](../../product/feeds/public-chat.md).
