# Query

## Purpose

Shared query and relay filter construction for feed surfaces.

## Documents

[docs/architecture/feeds/invariants/filter-safety.md](../../../docs/architecture/feeds/invariants/filter-safety.md)

## Modules

| Module | Role |
|--------|------|
| `timeline.ts` | Merge and filter matching helpers |
| `timeline-filters.ts` | Home, Global, Profile filter builders |

## Rules

- `buildTimelineFilters` returns no filters when Home has zero follow pubkeys.
- `assertRelayFilterIsProtocolSafe` rejects app-only filter keys.
