# Filter Safety Invariant

## Purpose

Relay `REQ` filters must contain only NIP-01 fields. Internal request metadata
must be stripped before wire send.

## Allowed wire keys

`ids`, `authors`, `kinds`, `#<single-letter-tag>`, `since`, `until`, `limit`

`search` only when the relay supports NIP-50 and the surface is search-specific.

## Forbidden on wire

`depth`, `source`, `feedKey`, `cursor`, `direction`, `profile`, `mode`, and any
other app-only field.

## Enforcement

- `buildTimelineFilters` / `buildNotificationFilters` produce protocol filters
- `assertRelayFilterIsProtocolSafe` throws in development and test builds
- Orchestration
  [lease-key.md](../../network/subscription-orchestration/lease-key.md)
  canonicalizes wire-equivalent filters before hashing

## Status

| Rule                      | Status      |
| ------------------------- | ----------- |
| Strip app keys before REQ | implemented |
| Unit assertion            | implemented |

## Tests

- `tests/unit/query/timeline-filters.test.ts`
- `tests/unit/notifications/notification-filters.test.ts`
