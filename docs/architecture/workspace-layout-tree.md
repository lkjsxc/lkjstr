Owner: Architecture
State: Canon

# Workspace Layout Tree

## Shape

The layout tree is either `null`, one pane node, or a split node.

- `null` means the workspace has zero panes.
- A pane node references a tab group id.
- A split node contains a direction, child nodes, and ratios.
- Split children can contain panes or nested splits.

## Invariants

- `focusedPaneId` may be `null`.
- `focusedTabId` may be `null`.
- A missing tab group renders as an empty pane.
- A tab group may have `activeTabId: null`.
- Split ratios normalize to one.
- Split nodes require at least two children.
- Direct split counts support two through twelve children.

## Recovery

Saved workspaces are normalized before rendering. Invalid layout records fall
back to an empty workspace instead of throwing during shell render.
