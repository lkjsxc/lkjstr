# Relay Optimizer

## Purpose

The relay optimizer turns real relay, cache, and scan observations into safer
scheduling, route-trust, span, wait, and diagnostic decisions. It is a
performance and observability layer only.

## Table of Contents

- [measurement-ledger.md](measurement-ledger.md): durable observation, density,
  score, and trace rows.
- [product-wiring-ledger.md](product-wiring-ledger.md): shipped surface wiring
  and open read-path gaps.
- [route-evidence-trust.md](route-evidence-trust.md): measured route trust and
  NIP-65 limits.
- [relay-read-scoring.md](relay-read-scoring.md): Rust score model and fairness.
- [scan-width-adaptation.md](scan-width-adaptation.md): density-based scan span
  selection.
- [relay-wait-policy.md](relay-wait-policy.md): first paint, incomplete state,
  and late merge.
- [stats-projection.md](stats-projection.md): Stats sections backed by real
  providers.
- [verification.md](verification.md): required checks and synthetic relay
  scenarios.

## Product Contract

- Observations come only from real relay reads and local cache evidence.
- Relay scores are computed in Rust from bounded observations.
- Scan spans are computed from per-request density models plus last-span hints.
- Selected user read relays remain the correctness fallback unless the user
  disables or removes them.
- Disabled relays are excluded before scoring, routing, scan planning, and
  fairness.
- NIP-65 relay lists are weak prior evidence. They can seed bounded targeted
  attempts, but they cannot suppress selected fallback, prove absence, or
  override measured reads.
- Adaptive scan models are performance input only. They never prove cache
  absence, suppress an uncovered relay, or mark incomplete history exhausted.
- Cache-first absence requires complete interval-union coverage for every
  required semantic feed key, route group, relay URL, filter key, and interval.
- The UI renders progressive rows and never waits for every contacted relay to
  EOSE before first useful rows are visible.
- Stats shows real optimizer state or explicit unavailable rows. Fake relay
  counters, fake scan traces, and synthetic route records are forbidden.

## Rust Ownership

- `lkjstr-relays` owns relay read scoring, route evidence trust, ordering, and
  fairness reducers.
- `lkjstr-app` owns scan density planning, wait policy, late merge, and
  feed-visible traces.
- `lkjstr-storage` owns optimizer row codecs, retention, repair, and inventory.
- `lkjstr-web` owns serializable WASM bridges and browser provider adapters.
- `lkjstr-ui` renders Stats rows from real providers and unavailable states.

## Related Contracts

- [../progressive-relay-rendering.md](../progressive-relay-rendering.md)
- [../relay-routing.md](../relay-routing.md)
- [../subscription-orchestration/README.md](../subscription-orchestration/README.md)
- [../../data/feed-coverage.md](../../data/feed-coverage.md)
- [../../data/cache-first-feed-pages.md](../../data/cache-first-feed-pages.md)
- [../../../product/tools/stats.md](../../../product/tools/stats.md)
