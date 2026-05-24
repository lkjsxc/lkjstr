# Relay Pool

## Purpose

The relay pool owns WebSocket clients, subscription messages, verified incoming
events, publish acknowledgements, and relay snapshots.

## Rules

- Normalize relay URLs before opening sockets.
- Reuse one client per relay URL.
- Verify events before delivering them to callers.
- Reject verified events that do not match the stored filters for their
  subscription id.
- Reject events for unknown subscription ids.
- Parse inbound text frames without an app-imposed byte ceiling.
- Invalid inbound text frames fail by JSON or protocol parsing.
- Reject unsupported binary or non-text frames with parse diagnostics.
- Send `CLOSE` when a subscription cleanup runs.
- Delete per-subscription `EOSE`, `CLOSED`, and filter state when cleanup runs.
- Keep snapshots for connection state, connection timing, last message time,
  last event id, last error, validation counters, and EOSE.
- Keep snapshot counters for bytes, active subscription ids, relay message
  totals, OK accepts, OK rejects, and last message timestamps.
- Stats reads snapshots only and must not create relay subscriptions.
- Keep current-session diagnostics as a flat stream derivable from snapshots.
- Throttle repeated app-log diagnostics while keeping snapshot diagnostics and
  counters raw.
- Persist relay diagnostic summaries without changing user relay settings.
- Bound pending send queues per relay and report `send-queue-full` when a
  queued message is dropped before the socket opens.
- Bound pending `REQ` queues per relay and report queue drops.
- Clamp filter limits to cached NIP-11 relay limits when present.
- Reject outgoing `REQ` messages that exceed cached NIP-11 message limits.
- Reconnect unexpected close or error with bounded exponential backoff only
  while restorable work remains.
- Do not require relay connections during workspace shell render.
- Do not overwrite user relay settings from runtime health data.
- Failed relays must not stop other relays in the same subscription.

## Runtime Use

- Runtime tabs subscribe through the subscription manager.
- The subscription manager calls the pool with enabled read relays only.
- Each relay subscription uses one compact relay-facing subscription id.
- Relay-facing subscription ids are bounded to `48` characters.
- Request purposes are forwarded with subscriptions so session compatibility
  evidence can skip only incompatible relay/request pairs.
- Subscription strategy is forwarded with subscriptions. Live managers use
  `forward`; paged reads use `backward` and close after `EOSE` or timeout.
- Overlong `REQ` and `CLOSE` ids are rejected locally with diagnostics and are
  not sent to relays.
- Stricter relay subscription-id limits use wire aliases while preserving
  logical ids in application callbacks and snapshots.
- Relay `CLOSED` marks that subscription terminal for that relay.
- Relay `CLOSED` policy messages such as missing `kinds` or missing `search`
  are retained as current-session compatibility evidence.
- Current-session compatibility evidence is bounded and expires; it must not
  grow with every historical subscription id.
- Inbound parse diagnostics may include measured byte size when available, but
  never store raw relay payloads.
- Cleanup must close that subscription on every relay after the last listener.
- Cleanup must not send `CLOSE` after a relay has already sent `CLOSED` for the
  subscription.
- Publish OK waiters must clear their timeout and remove waiter entries exactly
  once.
- Pending publishes are retried once per new connection generation until their
  existing timeout resolves.

## Browser Diagnostics

- A clean Playwright browser is authoritative for app-origin console messages.
- If the SES lockdown message is absent in clean Playwright, document it as
  external extension or provider injection.
- Do not add synthetic SES handling unless clean-browser verification
  reproduces an app-origin failure.
