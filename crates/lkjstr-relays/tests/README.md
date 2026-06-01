# Relay Tests

## Purpose

Relay tests port browser-independent runtime behavior from the current
TypeScript relay modules.

## Table of Contents

- `close_tombstones_test.rs`: TTL, membership, and max-size pruning.
- `client_reducer_test.rs`: pure relay client lifecycle reducer behavior.
- `request_scheduler_test.rs`: pending queue and release behavior.
- `send_queue_test.rs`: bounded FIFO send queue behavior.
- `subscription_alias_test.rs`: subscription id hashing and alias lookup.
