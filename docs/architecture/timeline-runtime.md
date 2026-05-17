Owner: Architecture
State: Canon

# Timeline Runtime

## Role

The timeline runtime connects cached events, relay subscriptions, and timeline
UI state for a single visible timeline tab.

## Data Flow

- Load cached kind `1` events first.
- Resolve enabled read relays from user relay sets.
- Use the default relay set when no user relay set is available.
- Subscribe with `{ kinds: [1], limit: 50 }` by default.
- Accept verified relay events from the relay pool.
- Store received events in IndexedDB.
- Merge cached and live events by id.
- Sort newest first.
- Track relay provenance for live events.
- Expose loading, error, connected relay count, and EOSE state.

## Lifecycle

- A timeline tab starts its subscription when mounted.
- A timeline tab stops its subscription when closed or unmounted.
- Closing a tile stops every timeline subscription owned by that tile.
- Relay failure does not block cached rendering.
- Timeline rendering does not require an account.
