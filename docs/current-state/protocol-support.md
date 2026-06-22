# Protocol Support

## Purpose

Implemented, partial, and diagnostic protocol support.

## Details

Read next: [protocol/README.md](../protocol/README.md),
[protocol/nip-support.md](../protocol/nip-support.md), and
[architecture/network/README.md](../architecture/network/README.md).

- Implemented Nostr surfaces include NIP-01, NIP-02, NIP-05, NIP-07, NIP-10,
  NIP-11, NIP-18, NIP-19, NIP-25, NIP-28, NIP-30, NIP-36, NIP-50, NIP-51,
  NIP-57, NIP-65, Blossom/NIP-B7 upload, NIP-96, and NIP-98.
- Partial protocol targets include NIP-29 relay-based groups and NIP-89 client
  tags. NIP-89 settings and shared TypeScript public publish enrichment are
  implemented, but it remains partial until every write surface and display
  option is verified.
- Relay AUTH is diagnostic-only. Search combines cached matches with relay
  NIP-50 filters when selected relays support them.
- Relay reads render progressive snapshots. Partial relay failure is diagnostic
  and must not block reachable relays.
- Selected read relays are eligible correctness fallback relays for Home,
  Global, Notifications, Profile, and Thread. The orchestrator may schedule,
  stagger, suspend, or rotate eligible relays by visible demand, score, and
  budget, but missing reads never prove absence.
- Targeted reads may add bounded protocol-derived routes from NIP-65, NIP-02,
  entity or tag hints, event relay receipts, and local route evidence. Global
  stays selected-relay based.
- Disabled or removed relays stay excluded until the user restores them.
- NIP-11 relay metadata and NIP-65 suggestions come only from real protocol
  data. Suggestions require explicit import.
- Relay ingress uses app-owned byte and structure caps before expensive JSON or
  event parsing.
- Rust owns protocol codecs, event parsing, canonical serialization, event ID
  hashing, Schnorr checks, local signing, relay URL normalization, NIP-19,
  custom emoji, content warning, tag indexing, reaction parsing, action tags,
  relay-list parsing, Blossom descriptors, upload metadata parsing, NIP-98
  helpers, NIP-89 client-tag validation, NIP-29 group tag parsing, and NIP-02
  follow-list extraction.
