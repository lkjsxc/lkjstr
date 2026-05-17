# Readiness Checks

Owner: Operations
State: Canon

## Purpose

Use these checks before treating a product slice as ready.

## Browser Runtime

- App starts with no configured relays.
- App starts with existing IndexedDB data.
- App recovers from blocked or unavailable IndexedDB.
- App survives refresh during active relay subscriptions.
- App handles worker startup failure with a visible degraded state.

## Relay Behavior

- Invalid relay URLs are rejected before connection.
- Disabled relays receive no new subscriptions.
- Connection failures appear in the relay monitor.
- Publish results are recorded per relay.
- Subscription cleanup happens when a pane closes or pauses.

## Account Behavior

- Public-key-only accounts cannot publish.
- External signer failures are visible and scoped to signing actions.
- Local key persistence requires explicit consent.
- Account switching keeps workspace layout stable.

## UI Behavior

- Cached timelines render before live events.
- Empty states identify filters and relay scope.
- Composer drafts survive refresh.
- Workspace layout survives refresh.
- Mobile layout can reach every core action.
