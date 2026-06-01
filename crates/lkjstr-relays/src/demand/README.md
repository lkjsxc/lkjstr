# Demand Source

## Purpose

Demand source files define pure relay demand records, canonical lease
fingerprints, live filter normalization, and owner visibility registry state.

## Table of Contents

- `canonical.rs`: relay and filter canonical keys.
- `fingerprint.rs`: wire-equivalent fingerprint and lease key derivation.
- `mod.rs`: module exports.
- `registry.rs`: owner refcount and visibility registry.
- `registry_tail.rs`: registry snapshot and visibility helpers.
- `types.rs`: demand records, phases, surfaces, purposes, and visibility.
