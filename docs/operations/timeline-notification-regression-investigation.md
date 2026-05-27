# Timeline and Notifications Regression Investigation

## Purpose

Record suspected regression sources, changed behavior, and the fix mapping before
implementation. Baseline verification passed via `docker compose run --rm verify`
on 2026-05-27.

## Suspected commits

| Commit | Area | Risk |
|--------|------|------|
| `6f32a93` | Subscription orchestration lease sharing | Shared live leases; page cursor bleed across tabs |
| `cd84d3e` | Demand/Lease planner | Bootstrap/live lifecycle changes |
| `78ca64c` | Feed runtime snapshots | Cache restore may race live relay data |
| `34f3b4f` | Feed scroll surface unification | Shared paging paths for Home/Global/Notifications |
| `43fcd08` | Adaptive relay scans | Window/cursor semantics |
| `f7078c9` | Protocol-derived relay routing | Selected fallback groups on every page |

## Observed symptoms → mechanisms

### Home shows mostly own posts

- `handleMissingFollow` in `timeline-runtime-network.ts` sets
  `authors = [activePubkey]` and calls `subscribeNotes()` without clearing or
  re-filtering cached items loaded with a broader author set.
- `accountHomeAuthors` always includes the active pubkey (product canon when
  follows exist); the regression is **self-only after missing kind 3**, not
  include-self when follows exist.
- `loadCachedAccountHome` catch returns `authors: [pubkey]` on failure.

### Old posts at scroll top

- `runTimelineLoadOlder` merges shells into cache, emits interim state, then
  **`setCached(page.items)`** replaces the merged window.
- Cache restore from tab snapshots may apply after live events without a
  generation guard.

### Large gaps

- `routeGroups` adds selected-relay fallback author chunks on **every**
  initial/older/newer page read, not only bootstrap.
- Incomplete relay windows may be treated as complete for cursor advancement.

### Notifications unreliable

- Filters use `#p` correctly in `notification-runtime.ts` but share routing
  patterns with Home; classification must reject self-authored kind `1` without
  `#p`.

### No-account Home

- `loadCachedTimeline` without authors queries `kind: 'global'` while UI is Home.

## Fix mapping

| Fix | Module |
|-----|--------|
| `no-follow-list` empty + guidance, no self-only scan | `timeline-runtime-network.ts`, `timeline-state.ts`, product docs |
| Re-filter cache on author shrink | `timeline-load.ts`, `timeline-reducer.ts` |
| Merge-by-id paging, no replace-after-merge | `timeline-runtime-older.ts`, `timeline-reducer.ts` |
| Cache restore generation guard | `timeline-runtime-network-subs.ts`, snapshot restore |
| Route fallback bootstrap-only | `relay-routing.ts` or paging callers |
| Per-runtime page cursors | runtime keys, orchestration demand owners |
| Notification filter kernel | `notification-filters.ts`, `notification-reducer.ts` |
| Canonical ordering export | `event-order.ts` |
| Protocol-safe filters | `timeline-filters.ts` |

## Reproduction notes

1. Open Home with account that has no kind `3` on relays → self-only relay scan
   and stale cache from prior session authors.
2. Load older page → interim merge then full replace drops ordering context.
3. Open three Home tabs → load older in one tab may share scan cursor state.
4. Notifications: self post without `#p` must not appear as notification row.

## Test plan

- Unit: `timeline-filters`, `event-order`, `timeline-reducer`,
  `notification-filters`, updated `timeline-follow-loading`
- E2e: `timeline-regression.spec.ts` with fake relay scenarios A–F
- E2e: `timeline-multi-tab.spec.ts` for cursor isolation
