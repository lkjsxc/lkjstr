# Protocol Kernel

## Purpose

This file defines Rust protocol ownership. Status: design-only.

## Owner

`lkjstr-protocol` owns Nostr parsing, validation, encoding, signing, and safe
serialization.

## Required Surfaces

- Signed and unsigned event parsing.
- Lowercase 32-byte hex event IDs and pubkeys.
- Lowercase 64-byte hex signatures.
- Canonical event ID calculation.
- Schnorr signature verification and local signing.
- Relay message encoding and decoding.
- Filter parsing, matching, and send clamping.
- Relay URL normalization.
- NIP-05 profile lookup data.
- NIP-19 scalar and pointer entities.
- NIP-30 custom emoji parsing.
- NIP-51 list helpers used by the app.
- NIP-57 zap parsing.
- NIP-65 relay-list parsing.
- NIP-96 upload response parsing.
- NIP-98 HTTP auth event construction.

## Frame Policy

Inbound relay frames are rejected before expensive work when they exceed byte,
tag count, tag field count, or tag field byte limits.

Event verification recomputes the event ID first. Signature verification runs
only after event shape, byte policy, ID, and public key validation pass.

## Emoji Contract

Incoming custom emoji shortcodes accept letters, numbers, underscores, and
hyphens. Local manual shortcode creation emits only letters, numbers, and
underscores.

## Test Contract

Rust tests port the TypeScript protocol cases before product callers move. WASM
tests prove the exported protocol bridge calls real Rust code and returns typed
errors.
