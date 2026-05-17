Owner: Architecture
State: Canon

# Relay Pool

## Role

The relay pool owns WebSocket clients, subscription messages, verified incoming
events, publish acknowledgements, and relay snapshots.

## Rules

- Normalize relay URLs before opening sockets.
- Reuse one client per relay URL.
- Verify events before delivering them to callers.
- Send `CLOSE` when a subscription cleanup runs.
- Keep snapshots for connection state, last message time, last error, and EOSE.
- Do not require relay connections during workspace shell render.
- Do not overwrite user relay settings from runtime health data.
- Failed relays must not stop other relays in the same subscription.

## Timeline Use

- Timeline tabs subscribe through the pool.
- Timeline tabs pass enabled read relays only.
- Each timeline tab uses its own subscription id.
- Cleanup must close that subscription on every relay.
