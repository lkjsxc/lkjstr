Owner: Product
State: Canon

# Panes

## Purpose

Panes are the visible workspace regions that host tab groups.

## Pane Contract

- A pane has a stable id and exactly one tab group id.
- A pane is called a tile in visible UI.
- A pane does not persist with an empty tab group.
- A missing tab group is invalid persisted state and must be recovered.
- New tab creation lives in the left sidebar, not in each tile footer.
- Closing a pane removes its tab group and tab runtime state.
- Closing the final pane creates one recovery pane with a timeline tab.
- Tile header actions live in a three-dot menu.
- The menu exposes Split right, Split down, and Tile close.

## Split Contract

- A split node has a direction, children, and sibling ratios.
- Horizontal splits create columns.
- Vertical splits create rows.
- Split nodes may have any child count of two or more.
- Resizing one handle changes only the two adjacent siblings.
- Repeated split right creates horizontal N-way siblings.
- Repeated split down creates vertical N-way siblings.
- Direction changes wrap only the target pane and the new pane.
- Manual split-size reset controls are not exposed.

## Acceptance

- Closing a final tab removes its tile.
- Closing a final tile recovers one timeline tile.
- Three-column and five-row layouts can be created through repeated normal splits.
- Closing panes in an N-way split preserves remaining siblings.
