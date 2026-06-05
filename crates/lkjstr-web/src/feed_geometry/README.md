# Feed Geometry Bridge

## Purpose

This source directory owns the narrow WASM bridge for Rust feed geometry,
fragment planning, measurement reduction, and anchor reducers.

## Files

- `mod.rs`: exported `wasm_bindgen` functions.
- `bridge.rs`: JS value parsing, calls into `lkjstr-app`, and output encoding.
- `dto.rs`: serializable host-boundary shapes.
- `codec.rs`: geometry, model, measurement, and anchor conversion.
- `row_codec.rs`: visual row conversion.

## Rules

Bridge failures return explicit errors. Product callers must report bridge
unavailability honestly and must not fabricate successful geometry output.
