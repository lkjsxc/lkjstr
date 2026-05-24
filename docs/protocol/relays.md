# Relays

## Purpose

Relay docs define URL and relay-set behavior.

## Contract

- Relay URLs normalize to secure websocket URLs where possible.
- Relay sets contain relay records with enabled, read, and write flags.
- The selected default set drives Global reads, fallback reads, and Tweet
  publishing.
- Targeted read runtimes use enabled selected read relays plus bounded
  protocol-derived routes when available.
- Tweet publishing uses enabled write relays only.
- No runtime should connect to a disabled relay.
- NIP-11 relay information is fetched from the HTTP endpoint corresponding to
  the normalized relay URL.
- NIP-65 relay list metadata suggestions are stored separately from configured
  relay sets and require explicit import.
- Runtime route evidence is stored separately from relay-list suggestions and
  never imports relays into Relay Settings by itself.

## Subscription IDs

- Nostr wire subscription ids must be short, opaque, and no longer than `48`
  characters unless a relay publishes a stricter NIP-11 limit.
- When a relay limit is stricter than the app-facing id, the client maps the
  logical id to a short wire alias and maps inbound messages back before
  delivery.
- Relay ids may keep readable prefixes such as `tl`, `global`, `profile`,
  `thread`, and `notif`.
- Full author lists, cursors, event ids, public keys, relay URLs, and debug
  context must not be embedded in wire subscription ids.
- Large discriminators are represented by short hashes.
- Relay `CLOSED` is terminal for that subscription id.
- After relay `CLOSED`, the client must not send repeated bad `CLOSE` messages
  for the same subscription.

## Request Handling

- Inbound events are parsed, id-checked, signature-checked, and then matched
  against the stored filters for the subscription id before delivery.
- Events for unknown subscription ids or valid events outside their filters are
  rejected with diagnostics.
- NIP-11 `max_subscriptions`, `max_limit`, `max_message_length`, and
  subscription-id limits bound local `REQ` sending when available.
- Missing NIP-11 `max_message_length` does not create an app-defined inbound
  text-frame limit.
- Filters with `limit` above a relay's `max_limit` are clamped locally.
- Oversized `REQ` messages are rejected locally instead of split.
- Requests above the active subscription cap wait in a bounded queue. When the
  queue is full, the oldest non-critical pending request is dropped and
  diagnosed.
- Backward reads close once after `EOSE` and release their active slot. Live
  reads remain open until caller cleanup.
- Unexpected close or error reconnects only while restorable subscriptions,
  queued sends, or publish waiters still exist. Explicit close stops reconnect.
