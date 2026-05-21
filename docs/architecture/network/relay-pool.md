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
- Keep snapshot counters for bytes, active subscription ids, relay message
  totals, OK accepts, OK rejects, and last message timestamps.
- Stats reads snapshots only and must not create relay subscriptions.
- Keep current-session diagnostics as a flat stream derivable from snapshots.
- Do not require relay connections during workspace shell render.
- Do not overwrite user relay settings from runtime health data.
- Failed relays must not stop other relays in the same subscription.

## Runtime Use

- Runtime tabs subscribe through the subscription manager.
- The subscription manager calls the pool with enabled read relays only.
- Each relay subscription uses one subscription id.
- Relay-facing subscription ids are bounded to `64` characters.
- Overlong `REQ` and `CLOSE` ids are rejected locally with diagnostics and are
  not sent to relays.
- Relay `CLOSED` marks that subscription terminal for that relay.
- Cleanup must close that subscription on every relay after the last listener.
- Cleanup must not send `CLOSE` after a relay has already sent `CLOSED` for the
  subscription.

## Browser Diagnostics

- A clean Playwright browser is authoritative for app-origin console messages.
- If the SES lockdown message is absent in clean Playwright, document it as
  external extension or provider injection.
- Do not add synthetic SES handling unless clean-browser verification
  reproduces an app-origin failure.
