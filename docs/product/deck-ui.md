# Deck UI

Owner: Product Design
State: Canon

## Screen Model

The first authenticated or read-only screen is the deck. It is not a landing page. The deck is a workspace of tiles with a persistent sidebar or compact toolbar for accounts, relays, tile creation, and settings.

## Tile Types

- Timeline: renders ordered event lists from filters and relay sets.
- Composer: drafts and publishes signed events.
- Relay monitor: shows relay health and live operation status.
- Account: shows identities, signer capability, and profile metadata.
- Search/filter: helps build reusable filters from authors, tags, kinds, and relay scope.

## Tile Behavior

- Tiles have stable identity, title, type, data source, and layout coordinates.
- Moving or resizing a tile persists without requiring a server.
- A tile must expose its relay scope when the content depends on relay choice.
- A tile can be duplicated with the same configuration.
- A tile can be paused, which closes live subscriptions but preserves cached content.

## Timeline Behavior

- Cached events render before live relay responses.
- New live events enter through a pending-new state when the user is scrolled away from the top.
- Events are ordered by created_at, then deterministic event id tie-breaker.
- Duplicate event ids merge relay evidence, validation state, and seen timestamps.
- Invalid signatures never render as normal trusted events.

## Composer Behavior

- The composer is a tile, not a modal-only workflow.
- Draft state includes body, tags, kind, reply context, quote context, target relays, and selected account.
- The publish button is disabled until signing capability and target relays are valid.
- Per-relay publish status remains visible after completion.

## Empty And Failure States

Empty states must name the active relay scope and filter. Failure states must say whether the problem is no relays, disconnected relays, rejected filters, invalid account state, cache failure, or signer failure.
