# Protocol Source

## Purpose

Protocol source files define event, filter, message, signing, and NIP behavior.

## Table of Contents

- `blossom.rs`: Blossom upload endpoint, auth, and descriptor helpers.
- `bytes.rs`: byte, hex, ASCII, and UTF-8 helpers.
- `content_media.rs`: content and `imeta` media attachment helpers.
- `content_mentions.rs`: content NIP-19 profile mention helpers.
- `content_tags.rs`: content-derived mention and emoji tags.
- `crypto.rs`: Schnorr key, signature, and public-key helpers.
- `error.rs`: shared protocol error cases.
- `event.rs`: signed and unsigned event parsing.
- `event_builders.rs`: reply, reaction, repost, and zap request tag builders.
- `event_id.rs`: NIP-01 canonical serialization and event IDs.
- `event_reference_parts.rs`: shared event reference row assembly helpers.
- `event_reference_scan.rs`: shared content `nostr:` entity scanner.
- `event_reference_types.rs`: typed event-reference identity records.
- `event_references.rs`: event reference identity extraction.
- `event_sign.rs`: local event finalization from secret keys.
- `event_tags.rs`: tag parsing and frame policy checks.
- `event_verify.rs`: event ID and signature verification.
- `filter.rs`: relay filter parsing and event matching.
- `kinds.rs`: event kind constants and range classifiers.
- `message_parts.rs`: relay message parsing helpers.
- `messages.rs`: client and relay message codecs.
- `nip30.rs`: NIP-30 custom emoji helpers.
- `nip51.rs`: NIP-51 emoji list and set helpers.
- `nip36.rs`: NIP-36 content-warning helpers.
- `nip57.rs`: NIP-57 zap target and receipt helpers.
- `nip65.rs`: NIP-65 relay-list metadata parser.
- `nip96.rs`: NIP-96 upload discovery and response parsers.
- `nip98.rs`: NIP-98 HTTP auth event and header helpers.
- `nip19.rs`: public NIP-19 entity types and decoding.
- `nip19_encode.rs`: NIP-19 entity encoding.
- `nip19_tlv.rs`: NIP-19 TLV helpers.
- `reactions.rs`: NIP-25 reaction parsing helpers.
- `relay_url.rs`: relay URL normalization.
- `tags.rs`: tag value indexing and reply marker helpers.
