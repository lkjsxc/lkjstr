Owner: Product
State: Canon

# Workspace

## Purpose

The workspace is the primary product surface and is served at `/`.

## Workspace Contract

- A workspace is a browser-owned editor surface made of split tiles.
- A pane is the internal model term for one visible tile.
- A tab group belongs to one tile and contains at least one tab after each command.
- Initial tabs can include timeline, account manager, relay monitor, composer,
  settings, cache, notifications, profile, and posts.
- Later tab kinds must register through the pane registry before rendering.
- Workspace layout persists locally.
- `/` is the canonical route.
- `/workspace` is retired and is not a documented entry point.
- Empty tiles are not a normal persistent state.
- A tile closes automatically when its final tab closes.
- If the final tile closes, the app creates one stable recovery tile.
- The recovery tile opens a timeline tab using the default relay set.
- Pane state is separate from relay connection state.
- Closing a pane releases subscriptions owned by that pane.
- Splitting, moving focus, and resizing panes must not recreate unrelated subscriptions.
- Small screens use focused pane navigation instead of horizontal crowding.

## Screen Model

The first authenticated or read-only screen is the workspace. It is not a
landing page. A collapsible left sidebar exposes accounts, notifications,
posts, relays, settings, cache, compose, and timeline actions. New tabs are
opened from the sidebar, not from each tile footer.

## Pane Behavior

- Panes have stable identity, title, kind, data source, and layout coordinates.
- Splitting or resizing a pane persists without requiring a server.
- Split nodes support horizontal and vertical N-way division.
- Normal split right and split down actions create N-way siblings when the
  nearest split already uses the requested direction.
- A pane must expose its relay scope when the content depends on relay choice.
- A pane can be duplicated with the same configuration.
- A pane can be paused, which closes live subscriptions but preserves cached content.
- Focused pane actions must be reachable by keyboard and pointer.
- Tile header actions live in a three-dot menu with Split right, Split down,
  and Tile close.
- Manual split-size reset controls are not part of the UI.

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
- Collapse and reopen the sidebar.

## Acceptance

- A user can create a workspace with three timeline tiles through repeated split actions.
- Closing a final tab closes its tile.
- Closing the final tile creates one usable recovery tile.
- The workspace never stays blank after a close command.
- Each pane can use different filters.
- Layout survives reload.
- The workspace remains usable with ten active panes.
