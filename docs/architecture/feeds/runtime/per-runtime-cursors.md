# Per-Runtime Cursors

## Purpose

Separate shared event repository cache from per-tab runtime scan cursors.

## Keys

| Key | Scope | Shared across tabs |
|-----|-------|-------------------|
| Repository cache | account + feed kind + authors | yes |
| Runtime instance | pane + tab + surface + account | no |
| Older scan cursor | runtime instance | no |
| Live Demand owner | runtime instance id | no (lease may share wire) |

## Rules

- Loading older in tab A must not advance tab B `olderScanCursor`
- Tab close releases Demands owned by that runtime instance only
- Snapshot restore stores display cursors per tab, not global Home cursor

## Implementation

- `runtimeInstanceKey` on timeline runtime context
- `olderRelaySubscriptionId` includes runtime key segment

## Status

implemented

## Tests

- `tests/e2e/timeline-multi-tab.spec.ts`
