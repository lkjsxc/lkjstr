# Tile Menu

## Purpose

Tile menu docs define popover positioning and interaction behavior.

## Role

The tile menu is the anchored three-dot action menu in each tile header.

## Positioning Contract

- The popover anchors to the clicked trigger with `getBoundingClientRect()`.
- The popover renders in a fixed-position layer.
- Positioning does not depend on split child overflow or transforms.
- Bottom-end is preferred.
- The menu flips above the trigger when bottom space is insufficient.
- The menu clamps inside the viewport with a small margin.
- Position is recomputed on open, scroll, resize, and layout changes.
- Each tile owns its own trigger reference and coordinates.

## Interaction Contract

- Escape closes the menu.
- Outside pointer down closes the menu.
- Selecting an action closes the menu before running the action.
- Focus remains keyboard-safe.
- Menu z-index stays above tiles but below global modal surfaces.

## Acceptance

- Opening different tile menus positions each menu next to its clicked trigger.
- The menu is not clipped by tile overflow.
- Split resizing while open does not leave stale coordinates.
