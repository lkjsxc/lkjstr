# Workspace Layout Tree

## Purpose

Workspace layout docs define normalized pane and split tree invariants.

## Shape

The normalized layout tree is one pane node or a split node.

- A pane node references a tab group id.
- A split node contains a direction, child nodes, and ratios.
- Split children can contain panes or nested splits.

## Invariants

- `layout` is non-null after command completion.
- At least one pane exists after command completion.
- `focusedPaneId` points to an existing pane.
- `focusedTabId` points to an existing tab.
- A pane references an existing tab group.
- A tab group has at least one tab.
- `activeTabId` points to one tab in the group.
- Split ratios normalize to one.
- Split nodes require at least two children.
- Direct split-count UI is not exposed.
- Moving the last tab out of a pane removes that pane from the layout.
- Moving a tab into a pane center does not create a new layout node.

## Recovery

Saved workspaces are normalized before rendering. Invalid layout records,
missing groups, missing tabs, zero panes, and zero-tab groups recover to one
timeline pane while preserving workspace id and account id.

## Smart Splits

- Split right requests horizontal insertion.
- Split down requests vertical insertion.
- If the target pane already belongs to a same-direction split, insert the new
  pane beside the target and set equal sizes for that sibling group.
- If the parent split direction differs, wrap only the target and new pane.
- Repeated normal split actions create predictable N-way layouts without
  explicit multi-split controls.

## Split Insertion Primitive

- Tile menu splits and tab edge-drop splits both call `smartSplitPane` through
  `insertPaneBySplitIntent`.
- Edge drops map zone to direction and side: left/top to `before`, right/bottom
  to `after`; left/right to `horizontal`, top/bottom to `vertical`.
- Drag-created N-way layouts must match menu-created layouts for the same
  sequence of split directions on the same target pane.

## Move Commands

- Move commands use `findPane` and `removePane` to keep tab groups and layout
  nodes consistent.
- Invalid source panes, target panes, or tab ids are no-ops.
