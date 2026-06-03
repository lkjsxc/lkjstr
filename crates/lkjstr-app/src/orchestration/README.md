# Orchestration Source

## Purpose

This module owns pure browser-local orchestration reducers for cache mode,
selected relay fallback, prefetch, hydration, retention, and Stats traces.

## Table of Contents

- [mod.rs](mod.rs): module exports.
- [context.rs](context.rs): surface context and enabled relay derivation.
- [decision.rs](decision.rs): pure planning functions.
- [evidence.rs](evidence.rs): coverage and optimizer evidence states.
- [policy.rs](policy.rs): local planning policy defaults.
- [trace.rs](trace.rs): decision trace records.
- [tests.rs](tests.rs): unit coverage.
