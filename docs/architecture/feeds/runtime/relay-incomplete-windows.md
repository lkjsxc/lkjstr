# Relay Incomplete Windows

## Purpose

Relays may close before EOSE, timeout, or return sparse windows. Incomplete
scans must not mark a time range globally complete.

## Outcomes

| Signal                  | Treatment                      |
| ----------------------- | ------------------------------ |
| EOSE with enough events | Window complete for that relay |
| EOSE sparse             | Partial; other relays continue |
| Close before EOSE       | Incomplete, retryable          |
| Timeout                 | Incomplete, retryable          |
| bad req                 | Filter bug; fail visibly       |
| message too large       | Narrow filter/window           |

## Adaptive windows

- Sparse complete windows can grow the adjacent scan span because every
  contacted relay proved EOSE below its relay-effective cap.
- Incomplete windows cannot prove sparse history. They may split once when the
  current span can narrow the retry surface, but they must keep a conservative
  frontier when relay completion is still unproven.
- Event-limit windows are complete only as relay status, not as history proof.
  They split while possible and otherwise remain unresolved.

## Cursor advancement

- Do not advance global older cursor past a range until relay result is
  complete or explicitly marked `incomplete: true` with conservative `hasOlder`

## Status

implemented - relay page scan returns `incomplete` and density flags; runtimes
preserve `hasOlder` when incomplete or unresolved

## Related

- [../../network/subscription-orchestration/live-lease.md](../../network/subscription-orchestration/live-lease.md)
