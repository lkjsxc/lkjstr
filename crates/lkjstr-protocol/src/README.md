# Protocol Source

## Purpose

Protocol source files define event, filter, message, signing, and NIP behavior.

## Table of Contents

- `bytes.rs`: byte, hex, ASCII, and UTF-8 helpers.
- `crypto.rs`: Schnorr key, signature, and public-key helpers.
- `error.rs`: shared protocol error cases.
- `event.rs`: signed and unsigned event parsing.
- `event_id.rs`: NIP-01 canonical serialization and event IDs.
- `event_sign.rs`: local event finalization from secret keys.
- `event_tags.rs`: tag parsing and frame policy checks.
- `event_verify.rs`: event ID and signature verification.
- `filter.rs`: relay filter parsing and event matching.
- `message_parts.rs`: relay message parsing helpers.
- `messages.rs`: client and relay message codecs.
- `nip30.rs`: NIP-30 custom emoji helpers.
- `nip36.rs`: NIP-36 content-warning helpers.
- `nip19.rs`: public NIP-19 entity types and decoding.
- `nip19_encode.rs`: NIP-19 entity encoding.
- `nip19_tlv.rs`: NIP-19 TLV helpers.
- `relay_url.rs`: relay URL normalization.
