# Relays

## Purpose

Relay docs define URL and relay-set behavior.

## Contract

- Relay URLs normalize to secure websocket URLs where possible.
- Relay sets contain relay records with enabled, read, and write flags.
- The selected default set drives read subscriptions and Tweet publishing.
- Read runtimes use enabled read relays only.
- Tweet publishing uses enabled write relays only.
- No runtime should connect to a disabled relay.

## Subscription IDs

- Nostr wire subscription ids must be short, opaque, and no longer than `64`
  characters.
- Relay ids may keep readable prefixes such as `tl`, `global`, `profile`,
  `thread`, and `notif`.
- Full author lists, cursors, event ids, public keys, relay URLs, and debug
  context must not be embedded in wire subscription ids.
- Large discriminators are represented by short hashes.
- Relay `CLOSED` is terminal for that subscription id.
- After relay `CLOSED`, the client must not send repeated bad `CLOSE` messages
  for the same subscription.
