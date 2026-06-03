# Orchestration Database Memory

## Purpose

Database memory persists recoverable evidence that helps local decisions across
reloads without creating a remote service or unbounded UI state.

## Evidence Inputs

The orchestrator may read:

```text
relay read observations
relay read scores
route evidence scores
scan density models
feed coverage rows
cache ledger state
storage pressure
feed window state
row geometry models
hydration latency observations
visible or hidden owner state
user relay settings
disabled relay records
request budget limits
```

## Durable Tables

Suggested recoverable tables:

```text
orchestration_decision_traces
surface_demand_observations
page_read_outcomes
hydration_outcomes
row_geometry_observations
prefetch_outcomes
retention_pressure_observations
```

Rows are diagnostic or optimization data unless they explicitly store protected
user data. Protected data remains in protected repositories.

## Retention Rules

- Every table has an owner, age bound, count bound, and repair policy.
- Retention may delete only recoverable orchestration rows.
- Cache pressure never deletes accounts, local signing secrets, settings, relay
  sets, workspace state, Tweet drafts, active tab snapshots, jobs, or route
  blocks.
- In-memory runtimes expose explicit close or destroy cleanup paths.
- Durable keys exclude tab ids, pane ids, owner handles, request ids, and
  subscription ids unless the row is explicitly a tab snapshot.

## Storage Modes

Stats must show OPFS, memory fallback, or unavailable storage for orchestration
memory. Unavailable storage produces explicit unavailable decisions and never
pretends learning occurred.
