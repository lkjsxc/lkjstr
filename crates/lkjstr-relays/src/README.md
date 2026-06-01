# Relay Source

## Purpose

Relay source files define browser-independent lifecycle, queueing, scheduling,
aliasing, and close-tombstone behavior.

## Table of Contents

- `close_tombstones.rs`: late-frame suppression after local close.
- `client/`: pure relay client lifecycle reducer.
- `lib.rs`: public relay crate exports.
- `request_budget/`: pure relay request-budget derivation and filter clamping.
- `request_message_size.rs`: serialized outbound `REQ` byte budgeting.
- `request_scheduler.rs`: active and pending relay request scheduling.
- `send_queue.rs`: bounded outbound message queue.
- `subscription_alias.rs`: logical-to-wire subscription id mapping.
- `subscription_id.rs`: compact relay subscription id helpers.
