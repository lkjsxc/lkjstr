Owner: Product
State: Canon

# Relay Management

## Purpose

Relay management makes relay sets visible, editable, and diagnosable.

## Relay Set Contract

- A relay set has an id, name, seeded flag, and relay records.
- Relay records include URL, label, enabled, read, write, connection state,
  error, timestamps, and health counters.
- The browser seeds the public default relay set only when no relay
  configuration exists.
- Seeded relays are ordinary user-editable relays.
- Users can disable, edit, or remove seeded relays.
- Removed seeded relays do not reappear on reload unless the user restores
  defaults.
- Relay connections are lazy and are not required for shell render.

## Default Relay Set

The default relay set id is `public-default` and contains Damus, nos.lol,
Primal, Nostr.Band, and Offchain relays.

## Acceptance

- First boot creates one editable default relay set.
- Existing relay configuration is never overwritten.
- Relay Monitor shows seeded relays and does not block boot on failures.
