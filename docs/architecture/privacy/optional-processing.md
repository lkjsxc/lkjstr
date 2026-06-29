# Optional Processing Gates

## Purpose

This file defines category gates for optional processing.

## Categories

- `cookies`: optional lkjstr cookies. Essential product behavior does not depend
  on optional cookies.
- `telemetry`: optional outbound telemetry. No telemetry is sent by default.
- `nonEssentialStorage`: optional local records not required for the local-first
  workspace.

## Contract

Every optional feature checks the consent snapshot before it starts. A missing,
corrupt, or unreadable consent record is treated as all optional categories
disabled. Reject All and withdrawal produce the same disabled category state;
withdrawal also clears optional records.

The privacy reducer is pure data. The browser adapter owns localStorage and
cookie effects. Tests cover default disabled state, accept all, reject all,
custom category saves, and withdrawal cleanup.
