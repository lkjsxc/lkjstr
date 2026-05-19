# Relay Pool

## Purpose

The relay pool owns WebSocket clients, subscription messages, verified incoming
events, publish acknowledgements, and relay snapshots.

## Rules

- Normalize relay URLs before opening sockets.
- Reuse one client per relay URL.
- Verify events before delivering them to callers.
- Reject relay messages above `64 KiB` and record diagnostics before parsing.
- Send `CLOSE` when a subscription cleanup runs.
- Keep snapshots for connection state, last message time, last error, and EOSE.
- Do not require relay connections during workspace shell render.
- Do not overwrite user relay settings from runtime health data.
- Failed relays must not stop other relays in the same subscription.

## Runtime Use

- Runtime tabs subscribe through the subscription manager.
- The subscription manager calls the pool with enabled read relays only.
- Each relay subscription uses one subscription id.
- Cleanup must close that subscription on every relay after the last listener.
