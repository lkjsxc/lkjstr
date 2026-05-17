Owner: Product
State: Canon

# Workspace

## Purpose

The workspace is the primary product surface and is served at `/`.

## Workspace Contract

- A workspace is a browser-owned editor surface made of split panes.
- A pane is an independently configured Nostr view.
- A tab group belongs to one pane and may contain zero or more tabs.
- Initial tabs can include timeline, account manager, relay monitor, composer,
  settings, cache, notifications, profile, and posts.
- Later tab kinds must register through the pane registry before rendering.
- Workspace layout persists locally.
- `layout: null` is a valid empty workspace with zero panes.
- A workspace layout with one pane and zero tabs is a valid empty pane state.
- A user can close every tab without breaking the UI.
- A user can create one pane from a zero-pane workspace.
- Pane state is separate from relay connection state.
- Closing a pane releases subscriptions owned by that pane.
- Splitting, moving focus, and resizing panes must not recreate unrelated subscriptions.
- Small screens use focused pane navigation instead of horizontal crowding.

## Screen Model

The first authenticated or read-only screen is the workspace. It is not a
landing page. The retired `/workspace` route is not a normal entry point. A
persistent activity bar exposes accounts, notifications, posts, relays,
settings, cache, compose, and timeline actions.

## Pane Behavior

- Panes have stable identity, title, kind, data source, and layout coordinates.
- Splitting or resizing a pane persists without requiring a server.
- Split nodes support horizontal and vertical two-way and N-way division.
- Quick split counts are two, three, and five; custom split counts support two
  through twelve panes.
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
- Open settings.
- Restore the default workspace from an empty workspace.

## Acceptance

- A user can create a workspace with three timeline panes.
- A user can close all tabs and reopen settings, accounts, or timeline.
- A user can close all panes and create a pane from the empty workspace.
- A user can split one pane into three columns or five rows.
- Each pane can use different filters.
- Layout survives reload.
- The workspace remains usable with ten active panes.
