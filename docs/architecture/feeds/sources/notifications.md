# Notifications Feed Source

## Purpose

Notifications index events that **target** the active account, not events the
account authored.

## Filters

Primary relay read:

```txt
kinds: 0, 1, 6, 7, 16, 9735 (notificationEventKinds)
#p: [activeAccountPubkey]
```

Must **not** use:

```txt
authors: [activeAccountPubkey]   // fetches own posts, not notifications
```

## Classification

After ingestion, rows are classified (mention, reply, reaction, etc.). Kind `1`
authored by self without `#p` containing self is **not** a notification row.

## Independence

- Never built from Home `authorFilters`
- `buildNotificationFilters` is separate module
- Paging readiness comes from the runtime cursor, not from whether records were
  produced by the initial relay page.
- Cache-first proof must use the notification feed key, account `#p` filter,
  relay, route group, and bounded interval. Grouped scans prune covered relays;
  the top-level immediate return path is still open.
- Bootstrap and historical reads use the shared adaptive grouped scanner with a
  one-minute initial window. Complete sparse windows advance through adjacent
  notification history with doubled spans, balanced complete windows keep the
  span, and limit-hit windows shrink and retry before they can render as
  complete coverage.
- Notification runtimes derive records only from events inside the requested
  cursor or scanner window.

## Protocol-Safe Filter Checklist

A notification relay filter is protocol-safe only when it includes:

- `kinds: [0, 1, 6, 7, 16, 9735]`
- `#p: [activeAccountPubkey]` (targeting, not authors)
- `limit: pageSize`
- Required cursor bounds by phase:
  - Bootstrap + historical reads: include both `since` and `until`
  - Live reads: include `since` (runtime start)
- No `authors` field is present (never reuse Home filter semantics)

## Status

| Rule                                   | Status      |
| -------------------------------------- | ----------- |
| `#p` targeting                         | implemented |
| Reject self-authored non-target events | implemented |
| Distinct from Home filters             | implemented |

## Tests

- `tests/unit/notifications/notification-filters.test.ts`
- `tests/unit/notifications/notification-paging.test.ts`
- `tests/unit/notifications/notification-window.test.ts`
