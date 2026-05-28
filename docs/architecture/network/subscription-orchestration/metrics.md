# Orchestration Metrics

## Purpose

Counters and gauges for Stats and memory verification. Metrics must not open
subscriptions or mutate relay settings.

## Gauges

| Name              | Meaning                              |
| ----------------- | ------------------------------------ |
| `activeDemands`   | registered owner demands             |
| `activeLeases`    | fingerprints with at least one owner |
| `liveLeases`      | open live wire subscriptions         |
| `bootstrapLeases` | in-flight bootstrap/page reads       |

Stats presents these orchestration gauges separately from raw relay wire
subscription rows so shared demands and physical `REQ` messages are not
conflated.

## Counters

| Name                             | Meaning                              |
| -------------------------------- | ------------------------------------ |
| `relayReqTotal`                  | REQ opened through orchestrator      |
| `relayCloseTotal`                | CLOSE or page read completion        |
| `eventsReceived`                 | pool events seen by live leases      |
| `eventsAccepted`                 | events passed ingress classification |
| `eventsDroppedNonRenderCritical` | filtered before runtime listeners    |

## Related

- [../progressive-relay-rendering.md](../progressive-relay-rendering.md)
- `src/lib/relays/orchestration/metrics.ts`
