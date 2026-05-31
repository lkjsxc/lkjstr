# Protocol Tests

## Purpose

Protocol tests port current TypeScript protocol behavior to Rust.

## Table of Contents

- `bytes_test.rs`: strict byte and text conversion behavior.
- `content_tags_test.rs`: mention and emoji tag derivation.
- `crypto_test.rs`: key derivation, signing, verification, and redaction.
- `event_builders_test.rs`: event action tag builders.
- `event_test.rs`: event validation, frame limits, and event IDs.
- `filter_test.rs`: relay filter parsing and matching.
- `kinds_test.rs`: event kind range classifiers.
- `messages_test.rs`: client and relay message codecs.
- `nip19_test.rs`: NIP-19 scalar and TLV entity round trips.
- `nip30_test.rs`: NIP-30 custom emoji validation.
- `nip36_test.rs`: NIP-36 content-warning tags.
- `nip57_test.rs`: NIP-57 zap target and receipt helpers.
- `nip65_test.rs`: NIP-65 relay-list metadata parser.
- `nip96_test.rs`: NIP-96 upload metadata parsers.
- `nip98_test.rs`: NIP-98 HTTP auth helpers.
- `relay_url_test.rs`: relay URL normalization.
- `tags_reactions_test.rs`: tag indexes and reaction parsing.
