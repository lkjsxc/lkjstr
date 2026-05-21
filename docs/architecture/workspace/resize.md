# Resize

## Purpose

Resize docs define split handle math.

## Contract

- Pointer movement is divided by container size with a minimum of `240px`.
- Movements smaller than `2px` are ignored.
- The sensitivity multiplier is `1.8`.
- Adjacent panels keep a minimum ratio of `0.08`.
- Updated ratios are normalized and persisted in the workspace layout.
- Resize handles do not reserve separator layout space. They render as overlay
  hit targets with a thin 1px visual line.
- Pointer resizing and keyboard resizing use the same ratio update path.
- Focus styling stays visible on the resize line for keyboard users.
