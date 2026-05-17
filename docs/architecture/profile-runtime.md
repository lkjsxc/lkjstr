Owner: Architecture
State: Canon

# Profile Runtime

## Role

The profile runtime resolves profile input, reads cached metadata and authored
events, subscribes to relays, and exposes profile tab state.

## Data Flow

- Resolve hex pubkey, npub, nprofile, or active account before subscribing.
- Load cached kind `0` metadata and kind `1` authored notes first.
- Subscribe to enabled read relays for kind `0` and authored kind `1`.
- Store received kind `0` metadata and kind `1` notes in IndexedDB.
- Track relay provenance and freshness per metadata event.
- Merge posts by event id and sort newest first.

## Lifecycle

- Runtime starts when a Profile tab mounts.
- Runtime closes all subscriptions when the tab unmounts.
- Relay failure must not block cached identity display.

## Acceptance

- Cached metadata appears before relay updates.
- Unknown pubkeys return a stable empty profile state.
- Synthetic relay tests can provide metadata and posts deterministically.
