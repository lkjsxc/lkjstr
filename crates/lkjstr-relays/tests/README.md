# Relay Tests

## Purpose

Relay tests port browser-independent runtime behavior from the current
TypeScript relay modules.

## Table of Contents

- `close_tombstones_test.rs`: TTL, membership, and max-size pruning.
- `client_message_test.rs`: typed relay-message reducer behavior.
- `client_reducer_test.rs`: pure relay client lifecycle reducer behavior.
- `demand_lease_test.rs`: demand fingerprint and lease registry behavior.
- `page_read_dedupe_test.rs`: semantic page-read and read-option keys.
- `page_read_inflight_test.rs`: shared page-read registry cleanup behavior.
- `progressive_read_test.rs`: progressive read snapshot reducer behavior.
- `request_budget_test.rs`: request limit, warning, and read-cap derivation.
- `request_message_size_test.rs`: outbound `REQ` byte cap decisions.
- `request_scheduler_test.rs`: pending queue and release behavior.
- `send_queue_test.rs`: bounded FIFO send queue behavior.
- `subscription_alias_test.rs`: subscription id hashing and alias lookup.
