# Resize

## Purpose

Resize docs define split handle math.

## Contract

- Pointer movement is divided by container size with a minimum of `240px`.
- Movements smaller than `2px` are ignored.
- The sensitivity multiplier is `1.8`.
- Adjacent panels keep a minimum ratio of `0.08`.
- Updated ratios are normalized and persisted in the workspace layout.
