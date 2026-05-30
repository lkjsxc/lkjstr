# Effective Limits

## Purpose

Effective limits define how local app policy and relay metadata become outbound
request shape.

## Inputs

The derivation starts from intent, not from a universal event cap:

- runtime `pageSize`
- surface and purpose
- filter count and filter shape
- selected relay and resolved route group
- exact lookup flag
- cached NIP-11 limitation data
- app hard caps

## Policy

- Feed pages use `pageSize` as the visible target and compute bounded overfetch
  from filter count, relay count, and route-group shape.
- Metadata and route-discovery reads use small explicit caps documented in
  policy source constants.
- Exact event and id lookups keep exact filters. Safety caps may stop runaway
  reads, but the app does not invent broad feed limits.
- Search keeps NIP-50 `search` filters. Relays without NIP-50 support evidence
  are diagnosed; cached matches remain available.
- Custom Request keeps user filters and relays. Unsafe or missing `limit` values
  are clamped by app and relay caps before sending.
- Live reads do not inherit stale page limits.

## NIP-11 Use

- `max_limit` clamps each filter `limit` for that relay.
- `default_limit` causes the client to set an explicit `limit` when the desired
  result count exceeds the advertised default.
- `max_message_length` rejects oversized outbound `REQ` messages locally.
- `max_subscriptions` constrains active per-relay read slots and queueing.
- `max_subid_length` constrains relay-facing subscription ids.
- `auth_required`, `payment_required`, and `restricted_writes` create
  diagnostics, not silent read suppression.
- Created-at bounds are diagnostics first. Clamp only when the surface can prove
  it cannot hide valid results.

## Per-Relay Shape

Budgets are per relay. The app must not lower every relay to the strictest
relay's limit unless a caller explicitly merges them into one relay group that
cannot preserve per-relay wire shape.

## Result

An effective budget records:

- relay URL
- effective per-filter limit
- read `maxEvents`
- timeout
- message-length cap
- subscription cap
- subscription-id length cap
- warnings and clamp reasons
