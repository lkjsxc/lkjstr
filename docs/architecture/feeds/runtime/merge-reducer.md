# Merge Reducer

## Purpose

Timeline visible state is derived by merging events into a map keyed by id, then
sorting newest-first. Incoming pages never replace the entire map unless the
runtime is explicitly reset.

## State shape

```ts
TimelineReducerState = {
  itemsById: Map<eventId, TimelineItem>
  sortedIds: readonly string[]
  newestCreatedAt: number | null
  oldestCreatedAt: number | null
}
```

## Operations

- `createEmptyTimelineReducerState()` - empty map
- `mergeTimelineReducerState(state, incoming)` - upsert, sort, window cap
- `filterTimelineReducerByAuthors(state, authors)` - drop items outside authors

## Rules

| Scenario                 | Behavior                                                    |
| ------------------------ | ----------------------------------------------------------- |
| Older page arrives       | Merge below newer after sort                                |
| Cache restore after live | Merge; generation guard discards stale apply                |
| Duplicate ids            | Keep record with newer `created_at`, merge relay provenance |
| Author set shrinks       | Re-filter map; do not keep out-of-author rows               |

## Status

implemented - `src/lib/timeline/timeline-reducer.ts`

## Tests

`tests/unit/timeline/timeline-reducer.test.ts`
