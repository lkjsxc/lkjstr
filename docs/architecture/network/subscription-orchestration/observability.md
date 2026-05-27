# Orchestration Observability

## Purpose

Orchestration metrics prove subscription efficiency. They are count-only in user
interfaces and may include full detail in debug hooks for tests.

## Counters

| Counter                          | Meaning                                                |
| -------------------------------- | ------------------------------------------------------ |
| `activeDemands`                  | Demands registered (visible + hidden)                  |
| `activeLeases`                   | Leases with owner count &gt; 0 or incomplete bootstrap |
| `liveLeases`                     | Leases in `live` phase with owners                     |
| `bootstrapLeases`                | In-flight bootstrap Leases                             |
| `relayReqTotal`                  | `REQ` messages sent (all relays)                       |
| `relayCloseTotal`                | `CLOSE` messages sent                                  |
| `eventsReceived`                 | Raw `EVENT` messages before classification             |
| `eventsAccepted`                 | Events written to shared storage                       |
| `eventsDroppedDuplicate`         | Deduped before storage                                 |
| `eventsDroppedNonRenderCritical` | Rejected for surface bootstrap/live intake             |
| `timeToFirstRowMs`               | Per-surface bootstrap latency (histogram summary)      |
| `timeToEoseMs`                   | Bootstrap EOSE latency                                 |

Per-relay counters mirror REQ, CLOSE, received, and accepted where Stats already
shows relay totals.

## Log Events

Session log may record (throttled):

- Lease opened / closed with fingerprint prefix and phase.
- Demand attach / release with surface and owner prefix (no full tab body).
- Route escalation with miss reason.
- Bootstrap -> live transition per surface key.

## Stats Tab

Stats shows redacted orchestration rows:

- Active demands and leases (live vs bootstrap).
- REQ and CLOSE totals (session).
- Received vs accepted vs dropped (session).
- No subscription ids, filter JSON, or tab ids in Stats output.

## Debug Hook

`window.__lkjstrMemoryDebug()` and test hooks expose the same counters for
Playwright memory and subscription-efficiency specs.

## Verification Thresholds

Synthetic-relay E2E expects after pane churn:

- `activeLeases === 0`
- `activeDemands === 0`
- `liveLeases === 0`

Two Home tabs with the same account and relays expect `liveLeases === 1` while
both are visible.
