# Protocol examples

## Purpose

Native helpers for local verification using the same protocol kernel as the
browser client.

- `browser-fixtures.rs`: reads a root event and optional browser publications
  as JSON from stdin. Generates a fresh in-memory test key, signs metadata,
  reply, reaction and search fixtures, and emits those public events, NIP-19
  links and a verification result. It never emits or stores the secret key.
  `scripts/browser-relay.mjs` invokes it during `pnpm smoke:browser`.
