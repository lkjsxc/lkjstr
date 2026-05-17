Owner: Product
State: Canon

# Workspace

## Purpose

The workspace is the primary product surface.

## Workspace Contract

- A workspace is a browser-owned editor surface made of split panes.
- A pane is an independently configured Nostr view.
- Initial panes are timeline, custom filter, relay monitor, account, raw event, and composer.
- Later pane kinds must register through the pane registry before rendering.
- Workspace layout persists locally.
- Pane state is separate from relay connection state.
- Closing a pane releases subscriptions owned by that pane.
- Splitting, moving focus, and resizing panes must not recreate unrelated subscriptions.
- Small screens use focused pane navigation instead of horizontal crowding.

## Screen Model

The first authenticated or read-only screen is the workspace. It is not a landing page. A persistent sidebar or compact command bar exposes accounts, relays, pane creation, settings, and diagnostics.

## Pane Behavior

- Panes have stable identity, title, kind, data source, and layout coordinates.
- Splitting or resizing a pane persists without requiring a server.
- A pane must expose its relay scope when the content depends on relay choice.
- A pane can be duplicated with the same configuration.
- A pane can be paused, which closes live subscriptions but preserves cached content.
- Focused pane actions must be reachable by keyboard and pointer.

## User Actions

- Create a workspace.
- Rename a workspace.
- Split a pane horizontally or vertically.
- Close a pane.
- Duplicate a pane.
- Move focus between panes.
- Resize pane boundaries.
- Configure pane relays and filters.
- Open raw event details.
- Open relay diagnostics.

## Acceptance

- A user can create a workspace with three timeline panes.
- Each pane can use different filters.
- Layout survives reload.
- The workspace remains usable with ten active panes.
