# UI Composition

Owner: Architecture
State: Canon

## Composition Model

The deck is composed from tile controllers and tile views. Controllers own data subscriptions, cache queries, and actions. Views render state and emit user intent.

## Deck State

A deck layout record contains:

- layout id.
- tile ids.
- tile order.
- tile bounds.
- active account id.
- default relay set id.
- selected density and display preferences.

Deck layout is durable and can be restored before live relay connections complete.

## Tile Controller Contract

Each tile controller exposes:

- `state`: renderable state.
- `actions`: user-triggered commands.
- `subscriptions`: live resources owned by the tile.
- `dispose`: cleanup for relay subscriptions and timers.

Controllers may call relay pool, cache service, account service, and protocol helpers. Views do not call these services directly.

## Shared UI State

Shared state is limited to account selection, relay set selection, deck layout, user preferences, and global operation notices. Timeline scroll state and composer draft details remain tile-local unless explicitly saved.

## Accessibility And Responsiveness

- Keyboard navigation must reach tile controls, composer actions, account switcher, and relay controls.
- Tile resize and move actions need keyboard alternatives.
- Dense desktop layouts and narrow mobile layouts share the same tile model.
- Text wrapping must not cover controls or event content.
