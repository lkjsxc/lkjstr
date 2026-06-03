# Stats Projection

## Purpose

Stats is the user-visible observability console for optimizer behavior. It must
show real provider data or explicit unavailable rows.

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

## Overview Rows

- storage mode
- relay state
- active demands and leases
- in-flight reads
- queue pressure
- cache pressure
- last scan hint used
- last repair and compaction result

## Relay Health Rows

Relay Health includes URL, enabled read/write flags, discovery-only flag,
connection state, active subscriptions, REQ and CLOSE counts, events received,
events accepted, events dropped, OK accepted/rejected, bytes sent/received,
first-event timing, EOSE timing, timeout/auth/close/error counts,
event-limit count, score, fairness credit, and last observation time.

## Scan Optimizer Rows

Scan Optimizer includes surface, semantic feed key hash, route group, relay URL,
direction, initial span, current span, next span, last feedback, density EWMA,
complete/dense/incomplete counts, hint source, segments processed, and unresolved
frontier.

## Route Evidence Rows

Route Evidence includes author key prefix, relay URL, source, trust score,
measured success, measured failure, last success, last failure, and whether the
row was used in the current route plan.

## Cache And Coverage Rows

Cache and Coverage includes coverage proof status, complete intervals, gaps,
dense intervals, incomplete intervals, cache rows returned, uncovered relays
queried, and compaction invalidation count.

## Actions

- Refresh
- Enable auto-refresh
- Refresh storage inventory
- Compact now
- Repair storage
- Export redacted diagnostics JSON
- Copy redacted summary

## Action Rules

- Stats never opens relay subscriptions.
- Stats never changes relay settings.
- Stats actions use real storage paths.
- Unavailable providers show explicit unavailable rows.
- No fake counters, fake route evidence, or placeholder scan rows.
- Exports redact raw events, relay payloads, full filters, tab ids, request ids,
  and log messages.
