# Memory

Runtime memory helpers expose bounded retention and compact diagnostic counts.

## Table of Contents

- `runtime-memory.ts`: redacted app-owned runtime memory and feed-surface
  diagnostic snapshot.
- `runtime-diagnostics.ts`: async Rust diagnostics refresh composition.
- `feed-geometry-diagnostics.ts`: WASM bridge for Rust-owned feed geometry
  runtime counters.
- `scored-retention.ts`: pure scored retention helper for ephemeral data.
- `user-timeline-diagnostics.ts`: WASM bridge for Rust-owned User Timeline
  diagnostic aggregates.
