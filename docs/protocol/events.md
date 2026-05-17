# Event Semantics

Owner: Protocol
State: Canon

## Canonical Event Record

Events stored or rendered by the app use a normalized record:

- `id`.
- `pubkey`.
- `created_at`.
- `kind`.
- `tags`.
- `content`.
- `sig`.
- `validation`.
- `seen_on`.
- `first_seen_at`.
- `last_seen_at`.

`seen_on` is relay evidence. It records relay URL, receive time, and whether the event came from an initial query or live subscription.

## Validation States

- `valid`: id and signature verified.
- `invalid_signature`: signature failed.
- `invalid_shape`: event cannot be interpreted as a valid Nostr event.
- `unverified`: accepted temporarily only when verification is queued in a worker.

Unverified events may be staged in cache but must not be rendered as trusted content.

## Duplicate Handling

The event id is the identity. Repeated events merge relay evidence and timestamps. Conflicting payloads for the same id are invalid shape incidents and must be reported to protocol diagnostics.

## Timeline Ordering

Timeline ordering is deterministic:

1. Higher `created_at` first.
2. Lower lexical event id first for ties.

Relay receive time is evidence, not the primary timeline order.

## Tag Interpretation

The kernel exposes helpers for:

- reply root.
- reply parent.
- quoted event.
- mentioned pubkeys.
- referenced events.
- topics.
- relay hints.

Display code consumes parsed tag intent rather than searching tag arrays directly.
