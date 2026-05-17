Owner: Product
State: Canon

# Composer

## Purpose

The composer pane creates and publishes signed Nostr notes.

## Contract

- NIP-07 is the first signing path.
- Read-only accounts cannot publish.
- Text notes use kind `1`.
- Publishing shows per-relay status.
- Drafts persist locally until success or explicit discard.
- Failed relays remain visible with retry action.
- The raw unsigned event preview is available before signing.
- The signed event is never mutated after signing.

## Acceptance

- A NIP-07 account can publish a note to selected relays.
- `OK` relay responses update the publish result.
- Rejected relay responses remain visible.
- Draft content survives reload before publish.
