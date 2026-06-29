# Public Read Relays

## Purpose

This file defines relay availability for public read-only surfaces when durable
relay settings cannot be read.

## Contract

Global, public Profile, public User Timeline, Search, Author Context, and
Followees may read from session default public relays when durable relay settings
are unavailable. The fallback is allowed only for public read-only relay reads.
It never proves that the user's configured relay list is empty.

The session default list is the documented built-in public read relay set. The
runtime marks the source as session default caused by relay-settings storage
unavailability and shows a diagnostic row or status. Relay URLs remain real
WebSocket URLs. No events, counters, profiles, or relay responses are
synthesized.

Home and Notifications may require the active account and the configured relay
state. Publishing, profile edits, follows, unfollows, reactions, reposts, and
other writes must not use session default write relays. If durable write relays
are unavailable, write actions show an explicit unavailable state.

## Effective Relay Result

The public-read resolver returns plain data:

- `relays`: normalized real WebSocket relay URLs.
- `source`: `durable-settings`, `session-defaults`, or `unavailable`.
- `diagnostic`: absent for durable settings; otherwise a precise reason such as
  `opfs-owner-held` or `web-lock-unavailable`.
- `writeAllowed`: always false for `session-defaults`.

## Empty-State Rule

A relay-settings read failure does not render `No enabled relay` on public
read-only surfaces while session defaults are allowed. A later cache read
failure must preserve the fallback relay route plan already computed for that
surface. `No enabled relay` is reserved for real durable relay settings where
the selected user relay set has no enabled read relays, or for a surface whose
policy forbids session defaults.
