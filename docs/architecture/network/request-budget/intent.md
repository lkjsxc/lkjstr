# Request Budget Intent

## Purpose

Budget intent lists the fields that influence local relay request limits. It
does not define relay routing or user-facing rows.

## Contract

The orchestrator derives budgets from these fields after route planning and
before sending reads:

| Field | Role |
| --- | --- |
| `surface` | home, global, notifications, profile, thread, search, custom-request, or author-context. |
| `phase` | bootstrap, page, or live. |
| `direction` | initial, older, or newer when paging. |
| `purpose` | feed, metadata, event-lookup, route-discovery, or search. |
| `pageSize` | visible result target supplied by the runtime. |
| `selectedRelays` | user-selected read relay base set. |
| `routeGroupKey` | resolved relay group identity for targeted reads. |
| `filterShape` | normalized filter structure before budget clamping. |
| `authors` | sorted author set for feed or metadata reads. |
| `cursor` | paging boundary when present. |
| `exactEventLookup` | true for `ids`, direct event reference, and exact lookup requests. |

## Semantics

- Feed page reads target `pageSize` visible rows, then apply bounded overfetch so
  duplicate events and relay overlap do not starve the page.
- Exact event and id lookups preserve exact filter semantics. Budgets may reject
  unsafe messages, but they must not broaden or time-window exact filters.
- Search intent preserves NIP-50 `search` filters and cached fallback behavior.
- Custom Request preserves the user filter shape and selected relays, then clamps
  unsafe limits before sending.
- Live intent does not receive page-only `limit` values unless a live contract
  already requires one.

## Dedupe

Dedupe keys use the effective request shape after budgeting. They must exclude
owners, tab ids, pane ids, transient subscription ids, and raw caller options
that were normalized away.
