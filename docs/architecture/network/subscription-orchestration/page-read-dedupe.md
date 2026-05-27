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

## Producer rules

- Feed runtimes call `readPageByIntent` only for relay page scans.
- Per-tab cursors remain in runtime state; dedupe keys do not embed tab ids.

## Related

- [demand-intent.md](demand-intent.md)
- [bootstrap-live.md](bootstrap-live.md) (historical name; see live-lease.md)
- `src/lib/relays/orchestration/page-reads.ts`
