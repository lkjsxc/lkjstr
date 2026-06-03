# Scan Model Bridge

## Purpose

This module owns serde DTOs and WASM bridge calls for Rust feed scan density
planning. Browser code passes serializable context, models, and observations;
Rust returns span proposals, model updates, and key selections.

## Table of Contents

- [mod.rs](mod.rs): exported WASM functions.
- [bridge.rs](bridge.rs): JsValue parsing and response shaping.
- [codec.rs](codec.rs): DTO to app-model conversion.
- [codec_helpers.rs](codec_helpers.rs): conversion helpers.
- [dto.rs](dto.rs): serializable bridge records.
