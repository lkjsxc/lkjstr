# Protocol Kernel

## Purpose

Protocol kernel docs define the app boundary around Nostr rules.

## Role

The protocol kernel is the only layer that understands Nostr event rules. UI code, workers, and storage callers use kernel APIs instead of duplicating protocol checks.

## Responsibilities

- Own byte encoding helpers used by protocol-facing code.
- Generate local secret keys and derive public keys.
- Build unsigned event templates from product intents.
- Canonicalize event payloads before hashing as UTF-8 JSON.
- Compute event ids.
- Sign local events and verify Schnorr signatures.
- Encode and decode bech32 protocol entities.
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
- `crypto`: key generation, public-key derivation, signing, verification.
- `entities`: bech32 entity encode/decode and TLV handling.
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
