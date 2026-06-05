# Feed Geometry Bridge

## Purpose

This source directory owns the narrow WASM bridge for Rust feed geometry,
fragment planning, measurement reduction, and anchor reducers.

## Table of Contents

- [mod.rs](mod.rs): exported `wasm_bindgen` functions.
- [bridge.rs](bridge.rs): JavaScript value parsing, app calls, and output encoding.
- [dto.rs](dto.rs): serializable host-boundary shapes.
- [codec.rs](codec.rs): geometry, model, measurement, and anchor conversion.
- [row_codec.rs](row_codec.rs): visual row conversion.

## Rules

Bridge failures return explicit errors. Product callers must report bridge
unavailability honestly and must not fabricate successful geometry output.
