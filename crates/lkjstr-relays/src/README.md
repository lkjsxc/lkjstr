# Relay Source

## Purpose

Relay source files define browser-independent lifecycle, queueing, scheduling,
aliasing, and close-tombstone behavior.

## Table of Contents

- `close_tombstones.rs`: late-frame suppression after local close.
- `client/`: pure relay client lifecycle reducer.
- `demand/`: pure demand fingerprinting and lease owner registry state.
- `lib.rs`: public relay crate exports.
- `page_read/`: semantic page-read keys and progressive snapshot reducers.
- `request_budget/`: pure relay request-budget derivation and filter clamping.
- `request_message_size.rs`: serialized outbound `REQ` byte budgeting.
- `request_scheduler.rs`: active and pending relay request scheduling.
- `route_plan/`: pure relay route grouping and fallback planning.
- `send_queue.rs`: bounded outbound message queue.
- `subscription_alias.rs`: logical-to-wire subscription id mapping.
- `subscription_id.rs`: compact relay subscription id helpers.
