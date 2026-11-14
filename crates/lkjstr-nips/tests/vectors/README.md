# Vector provenance

## Purpose

Fetched from primary protocol sources on 2026-11-14. These fixtures contain
public test keys only. Never substitute real signing keys into fixtures.

## Table of Contents

- `nip44.json`: the entire official [NIP-44 vector file](https://github.com/paulmillr/nip44/blob/main/nip44.vectors.json).
  SHA-256: `269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040`.
  This is the checksum published by [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md),
  checked in the tests. All valid conversation/message/padding/encryption/long
  vectors and all invalid key/decrypt vectors are exercised.
- The vector file's historical invalid encryption lengths 65536 and 100000
  predate the current NIP-44 extended-prefix format. They are now accepted.
  `nip44_boundaries.rs` checks the current specification's exact payload hashes
  at 65535, 65536, and 65537 bytes, plus our explicit 1 MiB memory bound.
  Empty and oversized messages are rejected without allocating huge buffers.
- `bip340.csv`: all 19 official [BIP-340 test vectors](https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv),
  with LF line endings. SHA-256 of the vendored file:
  `01c8cabba63b4c9b2f44c975902990086a4fe56eee9d265b187d1e2c1d98ccfb`.
  Includes arbitrary message lengths, invalid points, out-of-range signature
  components, and signing with explicit auxiliary randomness.
- NIP-19/21 published examples are embedded in `entities.rs`, including
  public keys, a public test nsec, relay-hinted profiles/events, and addresses.
- `nip59-3/4/5.json`: rumor, signed seal, and signed gift-wrap from the
  [NIP-59 worked example](https://github.com/nostr-protocol/nips/blob/master/59.md).
  JSON formatting is normalized and the illustration's trailing comma removed;
  signed fields, ciphertext, and identifiers are unchanged.
- `nip27-0.json`: the [NIP-27 illustration](https://github.com/nostr-protocol/nips/blob/master/27.md).
  Its event ID does not match its canonical payload. The rejection test retains
  this defect instead of accepting an invalid event as an official vector.
- `nip57-0/1.json`: [NIP-57 request and receipt illustrations](https://github.com/nostr-protocol/nips/blob/master/57.md).
  The request IDs are inconsistent, the receipt lacks its signature, and its
  invoice description hash does not match its embedded description bytes.
  The BOLT11 itself has a valid signature and amount; those are tested
  independently. Illustrations are not valid receipt-verification vectors.
  Positive end-to-end zap tests generate an actual signed request, signed
  BOLT11 invoice, and signed receipt using test-only keys. The generator uses
  independent bit-string packing and signs the BOLT11 preimage directly.

Other tests are generated protocol cases and deterministic property-style
loops, not claimed as official vectors. No real relay, LNURL, or NIP-05
endpoint is contacted by tests.
