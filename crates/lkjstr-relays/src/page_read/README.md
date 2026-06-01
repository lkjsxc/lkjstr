# Page Read Source

## Purpose

Page-read source files define pure semantic keys, read dedupe keys, and
progressive read snapshot reduction for relay page reads.

## Table of Contents

- `dedupe.rs`: semantic page keys, route fingerprints, and read dedupe keys.
- `events.rs`: progressive event provenance merge and ordering.
- `intent.rs`: page-read intent and route group types.
- `mod.rs`: module exports.
- `progressive.rs`: progressive read reducer and selectors.
- `types.rs`: progressive read state, relay status, and snapshot types.
