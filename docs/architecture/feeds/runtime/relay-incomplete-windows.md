# Relay Incomplete Windows

## Purpose

Relays may close before EOSE, timeout, or return sparse windows. Incomplete
scans must not mark a time range globally complete.

## Outcomes

| Signal                  | Treatment                                      |
| ----------------------- | ---------------------------------------------- |
| EOSE with enough events | Window complete for that relay                 |
| EOSE sparse             | Complete sparse window; may grow adjacent span |
| Close before EOSE       | Incomplete, retryable                          |
| Timeout                 | Incomplete, retryable                          |
| bad req                 | Filter bug; fail visibly                       |
| message too large       | Narrow time window or filter shape             |

## Adaptive windows

- Sparse is not incomplete. A complete EOSE window with few events is sparse and
  may grow the adjacent scan span because every contacted relay proved EOSE
  below its relay-effective cap.
- A timeout, socket closure, auth stop, relay close, socket error, or missing
  detailed status is incomplete and must not grow as if history was proven
  sparse.
- Incomplete windows cannot prove sparse history. They may split once when the
  current span can narrow the retry surface, but they must keep a conservative
  frontier when relay completion is still unproven.
- Event-limit windows are complete only as relay status, not as history proof.
  They split while possible and otherwise remain unresolved.
- Message-too-large handling narrows the time window or filter shape; it never
  fakes EOSE completion.

## Cursor advancement

- Do not advance global older cursor past a range until relay result is
  complete or explicitly marked `incomplete: true` with conservative `hasOlder`

## Status

implemented - relay page scan returns `incomplete` and density flags; runtimes
preserve `hasOlder` when incomplete or unresolved

## Related

- [../../network/subscription-orchestration/live-lease.md](../../network/subscription-orchestration/live-lease.md)
