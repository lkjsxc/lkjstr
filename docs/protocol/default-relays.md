# Default Relays

## Purpose

Default relay docs define initial relay purpose seeding.

## Contract

- Relay purposes are `user` and `discovery`.
- The seeded user set id is `public-default`.
- The seeded user relay URLs are `wss://relay.damus.io`, `wss://nos.lol`,
  `wss://relay.primal.net`, `wss://offchain.pub`, `wss://r.kojira.io`,
  `wss://x.kojira.io`, and `wss://yabu.me`.
- The seeded discovery set id is `discovery-default`.
- The seeded discovery relay URLs are `wss://purplepag.es/` and
  `wss://directory.yabu.me/`.
- Clean storage seeds both purpose sets.
- Seeding happens only when no relay set exists.
- Existing seeded `public-default` sets are normalized to this list when loaded.
- Users may remove or disable seeded relays in either purpose.
- Disabled or removed relays are not silently restored.
- Empty or removed purpose lists stay empty until explicit restore.
- Restore defaults is an explicit Relay Settings action per purpose.
