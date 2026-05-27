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

## Cursor advancement

- Do not advance global older cursor past a range until relay result is
  complete or explicitly marked `incomplete: true` with conservative `hasOlder`

## Status

implemented - relay page scan returns `incomplete` flag; runtimes preserve
`hasOlder` when incomplete

## Related

- [../../network/subscription-orchestration/bootstrap-live.md](../../network/subscription-orchestration/bootstrap-live.md)
