Owner: Product
State: Canon

# Timeline

## Purpose

The timeline tile presents Nostr events from cache and live relay subscriptions.

## Contract

- The tile accepts explicit relays and filters.
- Empty relays produce an actionable setup state.
- Kind `1` notes are the first supported live event surface.
- New live events enter a buffer before joining the visible list.
- The visible list is virtualized.
- Ordering is `created_at` descending, then event ID ascending.
- Duplicate relay deliveries appear once.
- Verification state is visible per event.
- Relay provenance is visible per event.
- Muted pubkeys and words are hidden before rendering.

## Acceptance

- Cached timeline renders without relay connection.
- Live relay events appear after user action.
- New events do not move the scroll position unexpectedly.
- Backfill can request older events.
