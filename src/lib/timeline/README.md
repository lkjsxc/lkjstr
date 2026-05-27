# Timeline

## Purpose

Home and Global timeline runtimes, paging, follow-list loading, and merge helpers.

## Documents

Architecture contracts:
[docs/architecture/feeds/](../../../docs/architecture/feeds/README.md)

## Modules

| Module                             | Role                             |
| ---------------------------------- | -------------------------------- |
| `timeline-runtime.ts`              | Home runtime factory             |
| `global-timeline-runtime.ts`       | Global runtime                   |
| `timeline-runtime-network.ts`      | Follow EOSE and relay state      |
| `timeline-runtime-network-subs.ts` | Notes/meta subscriptions         |
| `timeline-runtime-paging.ts`       | Initial/older/newer relay pages  |
| `timeline-runtime-older.ts`        | Older page merge path            |
| `timeline-runtime-api.ts`          | Paging API surface               |
| `timeline-load.ts`                 | Cache-first account home load    |
| `follow-list.ts`                   | Authors and author filter chunks |
| `timeline-store.ts`                | Item merge and cache reads       |
| `timeline-state.ts`                | Status types and state helpers   |
| `timeline-reducer.ts`              | Map-by-id merge reducer          |
| `timeline-relay-state.ts`          | Relay snapshot helpers           |

## Rules

- Home never self-only scans on missing kind `3`.
- Paging uses `routeGroupsForPaging` without selected-author fallback chunks.
- Visible order uses `compareEventsNewestFirst` from `events/event-order.ts`.
