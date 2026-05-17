Owner: Product
State: Canon

# Timeline

## Purpose

The timeline pane presents Nostr events from cache and live relay subscriptions.

## Contract

- The timeline tab accepts explicit relays and filters.
- Empty user relays fall back to the default relay set.
- Kind `1` notes are the first supported live event surface.
- The first filter is `{ kinds: [1], limit: 50 }`.
- Cached kind `1` events load before live relay results.
- New live events merge into the visible list.
- Ordering is `created_at` descending, then event ID ascending.
- Duplicate relay deliveries appear once.
- Verification state is visible per event.
- Relay provenance is visible per event.
- Event rows show author, time, content, event id, and relay source.
- Author actions can open Profile tabs.
- Reply or thread actions can open Thread tabs.
- Loading, connected relay count, EOSE, and all-relays-failed states are visible.
- Timeline works without an account.
- Closing a timeline tab or tile closes its relay subscription.
- Disabled relays are excluded from new timeline subscriptions.

## Acceptance

- Cached timeline renders without relay connection.
- Live relay events appear after opening a timeline tab.
- Relay setting changes are respected after tab refresh or runtime restart.
- Public relay failures do not block successful relays.
- Automated tests use a synthetic relay.
- New events do not move the scroll position unexpectedly.
- Backfill can request older events.
