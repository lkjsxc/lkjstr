# UI Composition

Owner: Architecture
State: Canon

## Composition Model

The workspace is composed from pane controllers and pane views. Controllers own data subscriptions, cache queries, and actions. Views render state and emit user intent.

## Workspace State

A workspace layout record contains:

- layout id.
- pane ids.
- split tree.
- focused pane id.
- pane bounds.
- active account id.
- default relay set id.
- selected density and display preferences.

The split tree may be null when the workspace has zero panes. Views must treat
null focus ids and null active tab ids as valid render states.

Workspace layout is durable and can be restored before live relay connections complete.

## Pane Controller Contract

Each pane controller exposes:

- `state`: renderable state.
- `actions`: user-triggered commands.
- `subscriptions`: live resources owned by the pane.
- `dispose`: cleanup for relay subscriptions and timers.

Controllers may call relay pool, cache service, account service, and protocol helpers. Views do not call these services directly.

## Shared UI State

Shared state is limited to account selection, relay set selection, workspace layout, user preferences, and global operation notices. Timeline scroll state and composer draft details remain pane-local unless explicitly saved.

## Accessibility And Responsiveness

- Keyboard navigation must reach pane controls, composer actions, account switcher, and relay controls.
- Pane split, resize, and focus actions need keyboard alternatives.
- Dense desktop layouts and narrow mobile layouts share the same pane model.
- Text wrapping must not cover controls or event content.
