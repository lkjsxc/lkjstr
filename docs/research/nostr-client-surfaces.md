# Nostr Client Surfaces

Owner: Research
State: Current

## Required Surfaces

The app needs first-class surfaces for:

- relay selection.
- event validation.
- account capability.
- timeline filtering.
- publish feedback.
- local cache state.
- relay health.

## Research Assumptions

- Nostr users often need to understand which relays saw or accepted an event.
- Relay reliability varies enough that monitor UI is product-critical.
- Multiple account capability levels are normal: local signer, external signer, and public-key-only.
- Cached content improves trust when relay connections are slow or inconsistent.

## Evaluation Criteria

An implementation is strong when a user can answer:

- Which relays am I reading from?
- Which relays will receive this publish?
- Did each relay accept the event?
- Is this timeline empty, stale, loading, or blocked by relay failure?
- Can this account sign?
