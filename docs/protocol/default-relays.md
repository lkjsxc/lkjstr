# Default Relays

## Purpose

Default relay docs define initial relay set seeding.

## Contract

- The seeded set id is `public-default`.
- The seeded relay URLs are `wss://relay.damus.io`, `wss://nos.lol`,
  `wss://relay.primal.net`, `wss://offchain.pub`, `wss://r.kojira.io`,
  `wss://x.kojira.io`, and `wss://yabu.me`.
- Seeding happens only when no relay set exists.
- Existing seeded `public-default` sets are normalized to this list when loaded.
- Users may remove or disable seeded relays.
- Disabled or removed relays are not silently restored.
- Restore defaults is an explicit Relay Settings action.
