# Feed Sources

## Purpose

Discriminated feed sources drive filter construction. Each source has distinct
relay semantics; sources must not leak into one another.

## Table of Contents

- [home.md](home.md)
- [global.md](global.md)
- [profile.md](profile.md)
- [notifications.md](notifications.md)
- [public-chat.md](public-chat.md)

## Source kinds

| Kind          | Authors                         | Tags                  | Notes                                |
| ------------- | ------------------------------- | --------------------- | ------------------------------------ |
| home          | follow pubkeys + active account | -                     | never self-only fallback             |
| global        | omitted                         | -                     | all display kinds on selected relays |
| profile       | single profile pubkey           | -                     |                                      |
| notifications | omitted                         | `#p` = active account | not Home authors                     |
| public-chat   | omitted                         | `#e` = channel id     | channel chat, not note firehose      |

## Implementation

`TimelineFilterInput` in `src/lib/query/timeline-filters.ts` owns standard note
feeds. Public Chat uses separate NIP-28 channel filters and ordering rules.
