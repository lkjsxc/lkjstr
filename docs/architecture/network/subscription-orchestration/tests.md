# Orchestration Tests

## Purpose

List unit and end-to-end gates for the intent-only orchestrator.

## Unit

| Path                                                            | Proves                       |
| --------------------------------------------------------------- | ---------------------------- |
| `tests/unit/relays/orchestration/lease-fingerprint.test.ts`     | fingerprint stability        |
| `tests/unit/relays/orchestration/orchestrator-refcount.test.ts` | shared live lease refcount   |
| `tests/unit/relays/orchestration/lease-key.test.ts`             | wire-equivalent fingerprints |
| `tests/unit/relays/orchestration/page-reads.test.ts`            | semantic page dedupe keys    |

## End-to-end

| Path                                           | Proves                              |
| ---------------------------------------------- | ----------------------------------- |
| `tests/e2e/subscription-lease-sharing.spec.ts` | two Home tabs, one live notes REQ   |
| `tests/e2e/subscription-three-home.spec.ts`    | three Home tabs, bounded page reads |
| `tests/e2e/subscription-pane-churn.spec.ts`    | gauges return to zero               |

## Gates

Run quiet verification and Docker compose per `docs/operations/verification.md`.
