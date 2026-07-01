# Effective Read Plan

## Purpose

Define the compact plain-data result passed from storage and relay-setting
resolvers into feed providers.

## Result Fields

- `source`: `durable-settings`, `durable-empty`,
  `session-default-public-read`, or `settings-unavailable`.
- `relays`: normalized real WebSocket URLs.
- `diagnostic`: the exact storage or policy reason when durable settings are
  unavailable.
- `writeAllowed`: false for session-default and unavailable plans.

## Rules

Durable-empty means settings were readable and no enabled read relay exists.
Settings-unavailable means storage did not prove the durable set. If policy
allows session defaults, the plan contains the built-in public read relays and a
visible diagnostic. If policy forbids fallback, the plan remains unavailable and
queryless.

The plan does not synthesize relay success, events, profiles, or write
capability. Write flows must still prove signer availability and durable enabled
write relays.
