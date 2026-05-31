# Protocol Tests

## Purpose

Protocol tests port current TypeScript protocol behavior to Rust.

## Table of Contents

- `bytes_test.rs`: strict byte and text conversion behavior.
- `crypto_test.rs`: key derivation, signing, verification, and redaction.
- `event_test.rs`: event validation, frame limits, and event IDs.
- `filter_test.rs`: relay filter parsing and matching.
- `messages_test.rs`: client and relay message codecs.
- `nip19_test.rs`: NIP-19 scalar and TLV entity round trips.
- `relay_url_test.rs`: relay URL normalization.
