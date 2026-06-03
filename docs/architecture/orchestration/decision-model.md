# Orchestration Decision Model

## Purpose

Decision reducers are pure Rust functions that convert evidence and surface
demand into bounded plans with explainable traces.

## Inputs

An orchestration context contains current surface demand, selected relay state,
disabled relay records, request budgets, cache coverage, scan density models,
relay scores, route evidence, feed window state, row geometry, hydration
latency, storage pressure, and owner visibility.

## Outputs

The orchestrator may produce:

```text
route plan
relay ordering
scan span plan
page-read dedupe key
cache-first plan
hydration priority plan
prefetch plan
retention priority hints
Stats trace
```

## Pure Planning Functions

Initial reducers:

```text
plan_surface_read(context) -> SurfaceReadPlan
plan_feed_prefetch(context) -> FeedPrefetchPlan
plan_hydration(context) -> HydrationPlan
plan_cache_retention(context) -> RetentionHintPlan
```

Each function returns diagnostics that name the evidence used and the evidence
that was unavailable.

## Correctness Rules

- Selected read relays remain the fallback for Home, Global, Notifications,
  Profile, and Thread unless disabled or removed.
- Disabled relays remain excluded until the user restores them.
- Cache-first complete coverage returns SQLite rows before relay reads.
- Partial coverage renders cached rows and starts uncovered relay work.
- Optimizer evidence never proves absence and never suppresses required relays.
- Route fingerprints keep Home, Profile, Notifications, and Global evidence
  isolated unless a documented parent scope is explicitly selected.

## Functional Style

Reducers use small immutable records, deterministic sorting, typed outcomes,
explicit confidence fields, and owned cleanup handles for host effects.
