# Custom Request

## Purpose

This module owns pure Custom Request parsing, policy clamps, and request-mode
classification for Rust app composition. It does not perform relay reads or UI
rendering.

## Table of Contents

- `mod.rs`: module exports.
- `mode.rs`: exact versus adaptive-feed classifier.
- `parse.rs`: JSON shape parser and app policy clamps.
- `types.rs`: request, mode, and error records.
