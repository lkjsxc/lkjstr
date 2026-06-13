# Author Context Feed

## Purpose

Builds the narrow Rust Author Context feed view from shared feed rows plus
explicit unavailable states.

## Table of Contents

- `build.rs`: pure view-model and query-demand composition.
- `defaults.rs`: honest empty default for unconnected host paths.
- `mod.rs`: module exports.
- `queries.rs`: Author Context anchor and nearby query helpers.
- `types.rs`: input, status, source-state, and output records.
