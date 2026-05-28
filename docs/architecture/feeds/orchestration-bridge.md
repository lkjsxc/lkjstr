# Feed Orchestration Bridge

## Purpose

Link feed runtimes to subscription orchestration without duplicating planner
contracts.

## Flow

```txt
Feed runtime -> Intent (owner = tab id)
            -> Planner (route plan, demand build, wire key)
            -> Lease (wire-equivalent fingerprint)
            -> Subscription manager -> Relay pool REQ/CLOSE
```

## Surface rules

| Surface       | Bootstrap                       | Live                     | Page                |
| ------------- | ------------------------------- | ------------------------ | ------------------- |
| Home          | follow discovery + initial scan | `since` at runtime start | older/newer per tab |
| Global        | initial on selected             | live tail                | older per tab       |
| Profile       | metadata + posts by author      | post route plan          | route fingerprinted |
| Notifications | local + `#p` read               | live `#p`                | older per tab       |

## Home-specific

- Hidden tab: release live Demand, keep cache
- Bootstrap selected fallback: allowed during route discovery only
- Paging: `routeGroupsForPaging` without selected-author fallback chunks

## Related

- [../network/subscription-orchestration/README.md](../network/subscription-orchestration/README.md)
- [feed-route-isolation.md](../network/subscription-orchestration/feed-route-isolation.md)
- [routing-by-surface.md](../network/subscription-orchestration/routing-by-surface.md)

## Status

partial until Home and Profile route-fingerprinted regression coverage proves
route refresh, live lease replacement, and Profile paging isolation.
