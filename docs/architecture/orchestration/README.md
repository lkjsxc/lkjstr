# Orchestration

## Purpose

Orchestration is the browser-local decision layer that turns durable evidence
and current surface demand into route, scan, cache, hydration, prefetch,
retention, background work, and Stats plans.

## Table of Contents

- [database-memory.md](database-memory.md): durable recoverable decision memory.
- [decision-model.md](decision-model.md): pure planning inputs and outputs.
- [surface-inputs.md](surface-inputs.md): per-surface evidence boundaries.
- [background-work.md](background-work.md): non-blocking work ownership.
- [task-queue.md](task-queue.md): task scheduling shape and bounds.
- [cancellation.md](cancellation.md): owner-scoped cancellation rules.
- [stats.md](stats.md): Stats rows and trace projection.
- [verification.md](verification.md): unit, storage, host-boundary, and Docker
  checks.

## Boundaries

The orchestrator is not a remote backend. It is browser-local, SQLite-backed,
and recoverable. It may improve performance and diagnostics, but it cannot
change correctness rules.

Selected read relays are eligible fallback relays for Home, Global,
Notifications, Profile, and Thread unless disabled or removed. The orchestrator
may schedule, stagger, suspend, or rotate eligible relays by visible demand,
score, request budget, and backpressure. It may not treat a non-contacted relay
as proof of absence.

## Implementation Direction

- Pure Rust reducers define decisions first.
- SQLite rows persist evidence and traces with retention policies.
- WASM host wrappers pass current browser state and execute effects.
- Svelte remains host glue only until Rust feed runtime parity is real.
- Long work runs through cancellable owner-scoped tasks.
