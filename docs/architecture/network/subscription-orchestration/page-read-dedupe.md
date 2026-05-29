# Page Read Dedupe

## Purpose

Bootstrap and page reads dedupe by semantic intent, not by runtime `subId`.

## Phases

| Phase     | Closes on EOSE | Typical use                        |
| --------- | -------------- | ---------------------------------- |
| bootstrap | yes            | follow discovery, initial catch-up |
| page      | yes            | older/newer paging                 |
| live      | no             | forward tail                       |

## Semantic page key

`readPageByIntent` builds a manager read key from:

- surface
- phase and direction
- sorted authors
- cursor bounds (when present)
- route plan fingerprint
- page size

Owners may differ; identical semantic keys share one in-flight read via the
subscription manager.

Semantic page keys dedupe in-flight relay work only. Durable cache proof is
owned by [cache-first-feed-pages.md](../../data/cache-first-feed-pages.md) and
[feed-coverage.md](../../data/feed-coverage.md).

## Producer rules

- Feed runtimes call `readPageByIntent` only for relay page scans.
- Per-tab cursors remain in runtime state; dedupe keys do not embed tab ids.

## Cache Short-Circuit

Page dedupe occurs only when a relay read is needed. A fully cache-proven
bounded segment returns before `readPageDetailed`.

Partial cache proof still creates read keys only for uncovered relay
requirements. Semantic page keys must not include tab ids.

## Related

- [demand-intent.md](demand-intent.md)
- [live-lease.md](live-lease.md)
- `src/lib/relays/orchestration/page-reads.ts`
