# Relays

## Purpose

This directory contains relay configuration, clients, pools, diagnostics, and
subscription management.

## Table of Contents

- [orchestration/](orchestration/): Demand, Lease, and shared live subscription
  planning (see [orchestration/README.md](orchestration/README.md)).
- [request-budget/](request-budget/): pure request-budget derivation and
  application helpers.
- Relay URL normalization, default relays, WebSocket client, pool, health
  evidence, diagnostic summaries, NIP-11 relay information, NIP-65 relay list
  suggestions, and relay set storage.
- `subscription-descriptor.ts` derives redacted human labels for active relay
  subscriptions shown in Stats.
- Relay route helpers own selected fallback preservation, targeted author route
  caps, discovery groups, route blocks, and indexed route evidence lookup.
- `routeGroupsForPaging` preserves selected read relays as the fallback
  correctness set while targeted route groups guide scheduling.
