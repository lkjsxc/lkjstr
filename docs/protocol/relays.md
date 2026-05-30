# Relays

## Purpose

Relay docs define URL and relay-set behavior.

## Contract

- Relay URLs normalize to secure websocket URLs where possible.
- Relay sets have a purpose: `user` or `discovery`.
- User relay records contain enabled, read, and write flags.
- Discovery relay records contain enabled state and diagnostics, but their read
  and write flags are ignored by runtime routing.
- The selected user set drives Global reads, fallback reads, and Tweet
  publishing.
- Targeted read runtimes use enabled selected read relays plus bounded
  protocol-derived routes when available.
- Tweet publishing uses enabled user write relays only.
- Enabled discovery relays are used only for kind `10002` relay-list metadata
  discovery and metadata discovery.
- Discovery-only relays must not widen feed, content, Search, Global, Custom
  Request, Profile post, Thread content, or Home content reads unless the same
  URL is also enabled as a selected user read relay.
- No runtime should connect to a disabled relay for that relay's purpose.
- NIP-11 relay information is fetched from the HTTP endpoint corresponding to
  the normalized relay URL.
- NIP-11 fetches send an `application/nostr+json` accept header and store
  available or unavailable records for Relay Settings, Stats, and request
  budgeting.
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
- NIP-11 `max_subscriptions`, `max_limit`, `default_limit`,
  `max_message_length`, and subscription-id limits bound local `REQ` sending
  when available.
- NIP-11 `auth_required`, `payment_required`, `restricted_writes`,
  `min_pow_difficulty`, and created-at bounds are displayed as policy
  diagnostics. They do not silently suppress enabled read relays.
- Missing NIP-11 `max_message_length` does not remove the app ingress cap:
  inbound relay text frames are rejected above `1048576` bytes before parsing.
- Relay event parsing rejects event content above `262144` bytes, more than
  `512` tags, more than `16` fields per tag, or tag fields above `4096` bytes.
- Filters with `limit` above a relay's `max_limit` are clamped locally.
- When a requested result count exceeds NIP-11 `default_limit`, the client sends
  an explicit `limit`.
- Outbound `REQ` byte size is estimated before send and compared with the app
  cap and any relay `max_message_length`.
- Oversized `REQ` messages are rejected locally instead of split.
- Requests above the active subscription cap wait in a bounded queue. When the
  queue is full, the oldest non-critical pending request is dropped and
  diagnosed.
- Backward reads close once after `EOSE` and release their active slot. Live
  reads remain open until caller cleanup.
- Unexpected close or error reconnects only while restorable subscriptions,
  queued sends, or publish waiters still exist. Explicit close stops reconnect.
