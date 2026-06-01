# Ingress Classification

## Purpose

Classify incoming relay events before they reach feed runtimes so non-render
traffic does not inflate UI work.

## Module

Status: Rust owns the pure render-critical kind policy. TypeScript still calls
its product classifier until live lease wiring moves to Rust.

- `crates/lkjstr-relays/src/ingress.rs`
- `src/lib/relays/orchestration/ingress-classify.ts`

## Rules

- Classification runs after the subscription manager delivers pool events.
- Live leases may drop events that fail render-critical checks; counters record
  accepted versus dropped traffic.
- Scores, owners, and relay URLs do not influence render-critical policy.

## Related

- [metrics.md](metrics.md)
- [live-lease.md](live-lease.md)
