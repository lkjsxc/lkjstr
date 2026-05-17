Owner: Protocol
State: Canon

# Default Relays

## Role

Default relays give a fresh browser a useful relay configuration without making
that configuration a hidden dependency.

## Seed Set

- Set id: `public-default`.
- Name: `Public Default`.
- Relays: Damus, nos.lol, Primal, Nostr.Band, and Offchain.
- Every seeded relay is enabled for read and write.

## Rules

- Seed only when no relay set exists.
- Never overwrite user relay settings.
- Never re-add a removed default relay after reload.
- Store seeded relays in IndexedDB.
- Treat seeded relays as user-editable and removable.
- Relay Monitor shows seeded relay health.
- Failed default relays do not block app boot.
