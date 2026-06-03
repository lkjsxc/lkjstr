# Orchestration Stats

## Purpose

Stats explains orchestration decisions with real evidence and explicit
unavailable states.

## Rows

Orchestration Stats includes:

- active surface key and semantic feed key hash
- route plan source and selected relay count
- relay ordering score inputs
- scan span proposal and source scope
- cache-first coverage result
- page-read dedupe key and sharing count
- wait policy and late-merge window
- hydration priority queue length
- prefetch window and reason
- retention pressure and priority hints
- storage mode and unavailable provider list
- decision trace time

## Rules

- No fake Stats rows are allowed.
- If SQLite, OPFS, WASM, relay score, route evidence, scan density, or geometry
  providers are unavailable, Stats shows unavailable state.
- Stats never opens relay subscriptions or writes relay settings.
- Redacted exports remove raw events, full filters, tab ids, request ids,
  subscription ids, owner handles, and log messages.
