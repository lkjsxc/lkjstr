# UI Composition

## Purpose

UI composition defines component ownership.

## Contract

- `WorkspaceRoot` receives page state and workspace commands.
- `SplitNode` recursively renders layout nodes.
- `Pane` selects the active tab component.
- Tab components own their local runtime start and cleanup.
- Event components expose identity and event actions to workspace commands.
- Shared state is limited to accounts, notifications, relay sets, settings,
  workspace layout, and cache data.

## UI System Catalog

Shared component and interaction contracts live in
[ui-system/README.md](ui-system/README.md):

- identity surfaces and feed leading rows
- overflow menus for secondary actions
- feed shell and scroll ownership
- New Tab flat catalog grid
- media upload gate and emoji palette placement
