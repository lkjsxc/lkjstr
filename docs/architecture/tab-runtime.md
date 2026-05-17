Owner: Architecture
State: Canon

# Tab Runtime

## Role

Tab runtime code maps durable workspace tab records to mounted tab surfaces and
their subscriptions, timers, and local state.

## Contracts

- Every tab kind has a title, icon, default config, and component owner.
- `new-tab` has no relay subscription.
- Opening the tile plus creates a focused `new-tab` in that tile.
- New Tab conversion preserves the same tab id and tab group.
- Conversion updates kind, title, icon, config, state, and timestamp.
- Conversion does not change pane layout.
- Closing a tab releases subscriptions owned by its mounted component.
- Closing a tile releases every mounted runtime in that tile.

## Tab Kinds

`new-tab`, `timeline`, `notifications`, `profile`, `account-manager`,
`post-manager`, `thread`, `relay-monitor`, `relay-settings`, `composer`,
`settings`, and `cache-status`.

## Acceptance

- New Tab can become every registered real tab kind.
- Conversion never duplicates a tab.
- Closed tabs cannot keep relay subscriptions alive.
