# Orchestration Tests

## Purpose

List focused gates for the intent-only orchestrator.

## Unit Gates

| Path                                                                | Proves                         |
| ------------------------------------------------------------------- | ------------------------------ |
| `tests/unit/relays/orchestration/lease-fingerprint.test.ts`         | fingerprint stability          |
| `tests/unit/relays/orchestration/orchestrator-refcount.test.ts`     | shared live lease refcount     |
| `tests/unit/relays/orchestration/lease-key.test.ts`                 | wire-equivalent fingerprints   |
| `tests/unit/relays/orchestration/page-reads.test.ts`                | semantic page dedupe keys      |
| `tests/unit/relays/orchestration/page-reads-route-planning.test.ts` | route-aware page keys          |
| `tests/unit/relays/orchestration/live-demand-handles.test.ts`       | owner close and hidden release |

## Integration Gates

| Path                                                          | Proves                            |
| ------------------------------------------------------------- | --------------------------------- |
| `tests/unit/relays/subscription-manager-dedupe.test.ts`       | compatible reads dedupe           |
| `tests/unit/relays/subscription-manager-read-limiter.test.ts` | queued reads abort on close       |
| `tests/unit/timeline/timeline-runtime-close.test.ts`          | runtime close releases relay work |

## Gates

Run the subscription orchestration focused gate from
[../../../operations/focused-gates.md](../../../operations/focused-gates.md),
then the normal quiet and Docker verification from
[../../../operations/verification.md](../../../operations/verification.md).
