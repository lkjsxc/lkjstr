# Relay Score Bridge

## Purpose

This module exposes the Rust relay read scoring reducer to JavaScript through
plain JSON-compatible records. It contains no browser objects and no storage
work; callers pass score keys, previous scores, and observations.

## Table of Contents

- `codec.rs`: serde DTOs and conversions to `lkjstr-relays` records.
- `bridge.rs`: public bridge functions returning structured responses.
- `mod.rs`: module exports and tests.
