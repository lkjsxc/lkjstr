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
