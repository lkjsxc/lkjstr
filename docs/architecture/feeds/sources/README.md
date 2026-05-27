# Feed Sources

## Purpose

Discriminated feed sources drive filter construction. Each source has distinct
relay semantics; sources must not leak into one another.

## Documents

- [home.md](home.md)
- [global.md](global.md)
- [profile.md](profile.md)
- [notifications.md](notifications.md)

## Source kinds

| Kind          | Authors                         | Tags                  | Notes                                |
| ------------- | ------------------------------- | --------------------- | ------------------------------------ |
| home          | follow pubkeys + active account | -                     | never self-only fallback             |
| global        | omitted                         | -                     | all display kinds on selected relays |
| profile       | single profile pubkey           | -                     |                                      |
| notifications | omitted                         | `#p` = active account | not Home authors                     |

## Implementation

`TimelineFilterInput` in `src/lib/query/timeline-filters.ts`
