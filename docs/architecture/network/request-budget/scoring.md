# Budget and Relay Scoring

## Purpose

This file defines the boundary between request budgeting and relay read scoring.

## Contract

- Request budgeting decides effective local bounds.
- Relay scoring decides scheduling order and fairness delay.
- Scoring never removes an enabled relay from the correctness set.
- Missing NIP-11 metadata is not a negative score by itself.
- Slow, unavailable, or policy-restricted relays may be diagnosed and ordered
  later, but reachable enabled relays still receive fair attempts when the
  surface requires them.

## Keys

Budget and score keys must not include:

- tab ids
- pane ids
- transient owners
- runtime-local subscription ids
- raw request ids

Keys may include:

- normalized relay URL
- surface
- purpose
- route fingerprint
- effective filter shape

## Related

- [../subscription-orchestration/relay-read-scoring.md](../subscription-orchestration/relay-read-scoring.md)
- [../subscription-orchestration/page-read-dedupe.md](../subscription-orchestration/page-read-dedupe.md)
