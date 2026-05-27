# Ingress Classification

## Purpose

Classify incoming relay events before they reach feed runtimes so non-render
traffic does not inflate UI work.

## Module

`src/lib/relays/orchestration/ingress-classify.ts`

## Rules

- Classification runs after the subscription manager delivers pool events.
- Live leases may drop events that fail render-critical checks; counters record
  accepted versus dropped traffic.

## Related

- [metrics.md](metrics.md)
- [live-lease.md](live-lease.md)
