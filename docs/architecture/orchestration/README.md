# Orchestration

## Purpose

Orchestration is the browser-local decision layer that turns durable evidence
and current surface demand into route, scan, cache, hydration, prefetch,
retention, and Stats plans.

## Table of Contents

- [database-memory.md](database-memory.md): durable recoverable decision memory.
- [decision-model.md](decision-model.md): pure planning inputs and outputs.
- [surface-inputs.md](surface-inputs.md): per-surface evidence boundaries.
- [stats.md](stats.md): Stats rows and trace projection.
- [verification.md](verification.md): unit, storage, browser, and Docker checks.

## Boundaries

The orchestrator is not a remote backend. It is browser-local, SQLite-backed,
and recoverable. It may improve performance and diagnostics, but it cannot
change correctness rules.

Selected read relays remain the fallback for Home, Global, Notifications,
Profile, and Thread unless disabled or removed. Disabled relays are excluded
before every route, score, scan, and prefetch decision.

## Implementation Direction

- Pure Rust reducers define decisions first.
- SQLite rows persist evidence and traces with retention policies.
- WASM host wrappers pass current browser state and execute effects.
- Svelte remains host glue only until Rust feed runtime parity is real.
