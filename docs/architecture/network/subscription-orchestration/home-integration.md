# Home Integration

## Purpose

How Home uses intent-only orchestration for follow discovery, bootstrap, live
tails, and paging.

## Flow

```txt
Home runtime
  -> readPageByIntent (bootstrap: follow list, initial notes)
  -> submitLiveIntent (channel notes, channel meta)
  -> readPageByIntent (older/newer per tab cursors)
```

## Session startedAt

- Orchestrator uses `timelineSessionStartedAt` for home live `since` anchors.
- Key: account pubkey plus normalized sorted selected relays.
- All Home tabs for the same account and relay set share one anchor.

## Channels

| Channel | Phase     | Purpose                          |
| ------- | --------- | -------------------------------- |
| follows | bootstrap | kind 3 latest for active account |
| notes   | live      | kind 1 from followed authors     |
| meta    | live      | kind 0 for visible profiles      |

## Route refresh

- After initial page, orchestrator may run route-discovery page reads.
- Live notes lease reopens only when route plan fingerprint changes.

## Related

- [../../runtimes/home-runtime.md](../../runtimes/home-runtime.md)
- [../../../product/feeds/home.md](../../../product/feeds/home.md)
