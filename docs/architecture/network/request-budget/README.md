# Request Budget

## Purpose

Request-budget docs define how lkjstr turns runtime intent and relay metadata
into bounded relay `REQ` traffic. This subtree is the implementation contract
for NIP-11-driven local limits, diagnostics, and dedupe-relevant request shape.

## Status

Design target for the current implementation work. Move implemented behavior to
[../../../current-state.md](../../../current-state.md) only after tests prove the
source contract.

## Table of Contents

- [intent.md](intent.md): budget-relevant intent fields.
- [nip11.md](nip11.md): relay information fields and stale/failure behavior.
- [effective-limits.md](effective-limits.md): local limit derivation.
- [message-size.md](message-size.md): outbound `REQ` byte estimation.
- [scoring.md](scoring.md): score ordering without correctness filtering.
- [source-map.md](source-map.md): implementation file ownership.
- [tests.md](tests.md): verification gates.

## Contract Summary

- Runtimes state purpose and page shape; the orchestrator derives relay traffic.
- NIP-11 metadata is typed protocol data, not decoration.
- Missing NIP-11 metadata means unknown, not unsafe.
- Stale NIP-11 metadata may still provide conservative local safety bounds while
  the app refreshes it and labels it stale.
- Per-relay budgets are preferred over global minimum clamping.
- Request budgets affect effective filters, read caps, timeout policy, message
  length checks, subscription-id constraints, and diagnostics.
- Relay score changes scheduling order and fairness delay only. It must not
  suppress enabled relays or alter the correctness set.

## Related

- [../subscription-orchestration/README.md](../subscription-orchestration/README.md)
- [../../data/cache-first-feed-pages.md](../../data/cache-first-feed-pages.md)
- [../../../protocol/relays.md](../../../protocol/relays.md)
- [../../../product/tools/relay-management.md](../../../product/tools/relay-management.md)
- [../../../product/tools/stats.md](../../../product/tools/stats.md)
