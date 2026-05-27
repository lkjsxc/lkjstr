# Event Ordering Invariant

## Purpose

Every feed surface derives visible order from one canonical comparator. Relay
arrival order and append/prepend direction must not affect UI order.

## Comparator

```ts
compareEventsNewestFirst(a, b) =
  b.created_at - a.created_at || a.id.localeCompare(b.id)
```

Implementation: `src/lib/events/event-order.ts` delegates to
`compareEventsDesc` in `src/lib/protocol/event.ts`.

## Status

| Rule | Status |
|------|--------|
| Single exported comparator | implemented |
| Merge sorts after map-by-id | implemented via `timeline-reducer.ts` |
| UI does not sort independently | implemented |

## Applies to

Home, Global, Profile posts, Thread lists, Notifications source events, cache
reads, relay page merges, repository queries.

## Tests

- `tests/unit/events/event-order.test.ts`
- `tests/unit/timeline/timeline-reducer.test.ts`
