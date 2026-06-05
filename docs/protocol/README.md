# Protocol

## Purpose

Protocol docs define Nostr event, filter, relay, and NIP contracts.

## Table of Contents

- [default-relays.md](default-relays.md): seeded relay purpose sets.
- [custom-emoji.md](custom-emoji.md): NIP-30 custom emoji rules.
- [event-actions.md](event-actions.md): reactions, reposts, replies, and zaps.
- [events.md](events.md): event shape and validation.
- [kernel.md](kernel.md): protocol module boundary.
- [media-upload.md](media-upload.md): Blossom target, NIP-96 compatibility, and upload auth.
- [nip-support.md](nip-support.md): supported NIP surface.
- [relays.md](relays.md): relay URL and set behavior.
- [zaps.md](zaps.md): NIP-57 invoice handoff.

## Progressive Reads

Relay reads follow NIP-01 `EVENT`, `EOSE`, and `CLOSED` evidence. NIP-50 search
results are merged by event time with local cache results; relay relevance order
is not preserved in the combined feed. NIP-65 relay-list metadata can expand
targeted routes while selected read relays remain the fallback.
