Owner: Product
State: Canon

# Panes

## Purpose

Panes are the visible workspace regions that host tab groups.

## Pane Contract

- A pane has a stable id and exactly one tab group id.
- A pane may render an empty tab group.
- A missing tab group is treated as an empty pane, not a fatal state.
- Empty panes expose actions to open timeline, notifications, profile,
  accounts, posts, relays, composer, settings, split right, and split down.
- Closing a pane removes its tab group and tab runtime state.
- Closing the final pane leaves an empty workspace with `layout: null`.

## Split Contract

- A split node has a direction, children, and sibling ratios.
- Horizontal splits create columns.
- Vertical splits create rows.
- Split nodes may have any child count from two through twelve.
- Resizing one handle changes only the two adjacent siblings.
- Equalize sets all sibling ratios to the same value.

## Acceptance

- Empty panes render visible recovery actions.
- Three-column and five-row panes can be created directly.
- Closing panes in an N-way split preserves remaining siblings.
