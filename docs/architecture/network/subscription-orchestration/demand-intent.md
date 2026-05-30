# Demand Intent

## Purpose

Define what feed runtimes may submit to the orchestrator. Intent describes **what**
to read, not **how** to open relays.

## Invariant

```txt
owner != dedupeKey
```

- `owner`: tab or tool session id for refcount and visibility only.
- `dedupeKey`: semantic identity for shared leases and in-flight page reads.

Runtime `subId` values must not appear in dedupe keys.

## Live intent fields

| Field              | Role                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| `surface`          | home, global, notifications, profile, thread, search, custom-request, author-context |
| `owner`            | refcount handle                                                                      |
| `channel`          | notes, meta, notifications, thread, etc.                                             |
| `visibility`       | visible or hidden                                                                    |
| `accountPubkey`    | active account when required                                                         |
| `authors`          | note authors for home/global/profile paging                                          |
| `selectedRelays`   | user-selected read relay set                                                         |
| `sessionStartedAt` | shared live anchor for home (orchestrator may supply)                                |

## Page intent fields

| Field            | Role                                     |
| ---------------- | ---------------------------------------- |
| `surface`        | same enum as live                        |
| `owner`          | refcount for bootstrap tracking          |
| `phase`          | bootstrap or page                        |
| `authors`        | sorted author pubkeys                    |
| `selectedRelays` | selected relay set                       |
| `pageSize`       | page limit                               |
| `direction`      | initial, older, newer                    |
| `cursor`         | optional compound cursor for older/newer |
| `purpose`        | feed, metadata, event-lookup, route-discovery, search |
| `relayFilters`   | exact user or runtime filter shape       |
| `routeFingerprint` | resolved route group identity          |

## Budget-relevant rules

- `pageSize` is the visible result target; request budgeting decides wire
  overfetch and safety caps.
- `purpose` distinguishes feed pages from metadata, event lookup, route
  discovery, and Search.
- `relayFilters` preserve exact Search and Custom Request semantics before
  budget clamping.
- `routeFingerprint` separates route-group reads that share visible intent but
  differ in relay correctness requirements.
- Owners, tab ids, pane ids, and runtime subscription ids never influence budget
  derivation or semantic dedupe.

## Producer rules

- Runtimes call `submitLiveIntent` and `readPageByIntent` only.
- Runtimes must not call `routedAuthorRelays`, `readPage`, or `subscribeDemand` directly.
- Tool surfaces (search, custom request) use isolated owners; dedupe still applies when intent matches.

## Related

- [route-plan.md](route-plan.md)
- [lease-key.md](lease-key.md)
- [page-read-dedupe.md](page-read-dedupe.md)
