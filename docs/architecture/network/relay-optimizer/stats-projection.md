# Stats Projection

## Purpose

Stats is the user-visible observability console for optimizer behavior. It must
show real provider data or explicit unavailable rows.

Status: the TypeScript Stats surface shows real in-memory relay scores and scan
hints. It must also read durable scan density models and decision traces from
SQLite when those rows exist. Route evidence projection remains open.

## Sections

1. Overview
2. Relay Health
3. Active Work
4. Scan Optimizer
5. Route Evidence
6. Cache and Coverage
7. Storage Health
8. Jobs and Publish Queue
9. Runtime Memory
10. Rust/WASM Cutover
11. Redacted Diagnostics Export

## Scan Optimizer Rows

Scan Optimizer rows are backed by real scan density models and decision traces.
They include:

- surface and semantic feed key hash
- route group, relay URL, filter key, direction, and route fingerprint
- scan model source: exact, parent scope, or neutral
- fallback level and neutral reason when neutral was used
- target count, effective limit, and target fraction
- estimated density and confidence
- previous span, proposed span, and change cap factor
- cap reason when a cap was applied
- latest observation event count and final visible count
- limit-hit rate and incomplete rate
- last update time and staleness state
- storage mode: OPFS, memory fallback, or unavailable
- WASM bridge state: available, unavailable, or error with a redacted message

The browser debug surface may expose redacted scan optimizer data for
Playwright:

```text
window.__lkjstrDebug.scanModels()
window.__lkjstrDebug.scanDecisionTraces()
window.__lkjstrDebug.latestScanDecision()
window.__lkjstrDebug.scanOptimizerSnapshot()
window.__lkjstrDebug.storageMode()
```

These functions return real SQLite rows, current bridge/storage availability, or
explicit unavailable records. Debug projections must hydrate row identity from
SQLite columns when older `record_json` payloads do not contain it, so Stats
lists never use missing or duplicate Svelte keys. They must not expose local
signing secrets, raw relay payloads, full event bodies, tab ids, request ids,
owner handles, subscription ids, or unredacted filters.

## Relay Health Rows

Relay Health includes URL, enabled read/write flags, discovery-only flag,
connection state, active subscriptions, REQ and CLOSE counts, accepted and
dropped events, bytes sent and received, first-event timing, EOSE timing,
timeout/auth/close/error counts, event-limit count, score, fairness credit, and
last observation time.

## Cache And Coverage Rows

Cache and Coverage includes coverage proof status, complete intervals, gaps,
dense intervals, incomplete intervals, cache rows returned, uncovered relays
queried, and compaction invalidation count.

## Orchestration Rows

Database-backed orchestration rows include route choice, relay ordering, scan
span, wait policy, cache-first decision, hydration priority, prefetch decision,
retention hint, and the evidence classes that influenced each decision.

## Action Rules

- Stats never opens relay subscriptions.
- Stats never changes relay settings.
- Stats actions use real storage paths.
- Unavailable providers show explicit unavailable rows.
- No fake counters, fake route evidence, fake Stats rows, or placeholder scan
  rows are allowed.
- Exports redact raw events, relay payloads, full filters, tab ids, request ids,
  owner handles, subscription ids, and log messages.
