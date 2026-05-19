# NIP Support

## Purpose

This file records supported and planned Nostr protocol surfaces without claiming
unimplemented behavior.

## Core Support

- NIP-01 event shape, IDs, signatures, filters, and relay messages.
- NIP-07 browser extension signing.
- NIP-19 public-key, note, event, profile, and address entities.

## Product Support

- NIP-02 follow lists for home timelines.
- NIP-05 identifiers for profile display.
- NIP-10 reply and thread tags.
- NIP-18 repost target parsing and embeds.
- NIP-19 public-key, note, event, profile, and address references in content.
- NIP-25 reaction target parsing and embeds.
- NIP-42 relay auth diagnostics.

## Planned Product Support

- NIP-11 relay information documents.
- NIP-36 sensitive content gates.
- NIP-50 relay search when supported.
- NIP-65 relay list metadata.

## Later Support

- Encrypted direct messages wait for security docs and signer isolation.
- Wallet and zap sending wait for explicit wallet permission docs.
- Media upload waits for host and proxy safety docs.

## Rule

Protocol docs describe behavior only after tests or explicit implementation
tasks exist.
