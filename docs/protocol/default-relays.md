# Default Relays

## Purpose

Default relay docs define initial relay purpose seeding, clean-storage behavior,
and explicit restore semantics.

## User Default Set

The seeded user set id is `public-default`. It is editable and selected by
default on clean storage.

| URL                                | Label      | Scope  |
| ---------------------------------- | ---------- | ------ |
| `wss://relay.damus.io`             | Damus      | public |
| `wss://nos.lol`                    | nos.lol    | public |
| `wss://relay.primal.net`           | Primal     | public |
| `wss://offchain.pub`               | Offchain   | public |
| `wss://r.kojira.io`                | Kojira     | Japan  |
| `wss://x.kojira.io`                | Kojira X   | Japan  |
| `wss://yabu.me`                    | Yabumi     | Japan  |
| `wss://relay-jp.nostr.wirednet.jp` | Kiri Japan | Japan  |
| `wss://relay.nostr.wirednet.jp`    | Kiri World | world  |

## Discovery Default Set

The seeded discovery set id is `discovery-default`. It is editable but not
selected as the user read or write set.

| URL                        | Label            |
| -------------------------- | ---------------- |
| `wss://purplepag.es/`      | purplepag.es     |
| `wss://directory.yabu.me/` | Yabumi Directory |

## Contract

- Clean storage seeds both purpose sets only when no relay set exists.
- Seeded records use the same operation timestamp for the purpose set and each
  child relay row.
- Restore defaults replaces the requested purpose default set with the exact
  table above.
- Existing relay sets are not widened silently. Removed or disabled relays stay
  user-owned until explicit restore.
- Seed normalization may remove obsolete app-seeded URLs, but it must not add
  missing defaults behind the user's back.
- User relays keep enabled, read, and write flags.
- Discovery relay read and write flags are ignored by runtime routing.
- Users may add, remove, disable, relabel, or restore relays in either purpose.
