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
