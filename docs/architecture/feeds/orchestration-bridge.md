# Feed Orchestration Bridge

## Purpose

Link feed runtimes to subscription orchestration without duplicating planner
contracts.

## Flow

```txt
Feed runtime -> Demand (owner = runtimeInstanceKey)
            -> Planner -> Lease (fingerprint excludes tab id)
            -> Relay pool REQ/CLOSE
```

## Surface rules

| Surface       | Bootstrap                       | Live                     | Page                |
| ------------- | ------------------------------- | ------------------------ | ------------------- |
| Home          | follow discovery + initial scan | `since` at runtime start | older/newer per tab |
| Global        | initial on selected             | live tail                | older per tab       |
| Notifications | local + `#p` read               | live `#p`                | older per tab       |

## Home-specific

- Hidden tab: release live Demand, keep cache
- Bootstrap selected fallback: allowed during route discovery only
- Paging: `routeGroupsForPaging` without selected-author fallback chunks

## Related

- [../network/subscription-orchestration/README.md](../network/subscription-orchestration/README.md)
- [routing-by-surface.md](../network/subscription-orchestration/routing-by-surface.md)

## Status

implemented
