# Protocol Kernel

Owner: Protocol
State: Canon

## Role

The protocol kernel is the only layer that understands Nostr event rules. UI code, workers, and storage callers use kernel APIs instead of duplicating protocol checks.

## Responsibilities

- Build unsigned event templates from product intents.
- Canonicalize event payloads before hashing.
- Compute and verify event ids.
- Verify signatures.
- Validate kind, tags, content, created_at, pubkey, and id shape.
- Parse relay messages into typed results.
- Build relay filters from product query objects.
- Normalize event records for IndexedDB.
- Return structured errors with stable codes.

## Non-Responsibilities

- Choosing which relays the user trusts.
- Persisting records directly.
- Rendering display text.
- Owning account secrets.
- Ranking timeline content beyond deterministic ordering helpers.

## API Shape

Kernel APIs must be pure when possible. Functions that require signing accept an account signer interface and return signed events or typed signer errors.

Expected groups:

- `events`: create, hash, validate, verify, normalize.
- `filters`: build, merge, limit, compare, serialize.
- `messages`: parse relay messages and build client messages.
- `tags`: inspect mentions, replies, roots, quotes, topics, and relay hints.
- `errors`: classify protocol, relay, signer, and storage-adjacent failures.

## Error Contract

Every kernel error has:

- `code`: stable machine-readable identifier.
- `message`: short human-readable text.
- `recoverable`: boolean.
- `context`: small structured object without secrets.

Protocol errors are data, not thrown UI surprises. Throwing is reserved for programmer misuse.
