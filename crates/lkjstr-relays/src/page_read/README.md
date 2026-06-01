# Page Read Source

## Purpose

Page-read source files define pure semantic keys, read dedupe keys, and
progressive read snapshot reduction for relay page reads.

## Table of Contents

- `dedupe.rs`: semantic page keys, route fingerprints, and read dedupe keys.
- `events.rs`: progressive event provenance merge and ordering.
- `inflight.rs`: shared page-read registry and cleanup state.
- `inflight_read.rs`: private in-flight read record and cleanup counters.
- `intent.rs`: page-read intent and route group types.
- `mod.rs`: module exports.
- `progressive.rs`: progressive read reducer and selectors.
- `progressive_tail.rs`: progressive read reducer helpers.
- `types.rs`: progressive read state, relay status, and snapshot types.
