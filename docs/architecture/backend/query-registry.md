# Query Registry

## Purpose

Define how shared browser-local queries are keyed and attached.

Status: Rust owns pure demand-plan construction for future shared queries.
TypeScript still owns the live query registry used by the shipped product.

## Contract

- Query keys use semantic inputs only: account, selected relays, page size, and
  feed policy.
- Tab ids are attachment owners and never part of a shared query key.
- The first attachment creates and starts the query. Later matching attachments
  subscribe to the current snapshot and must not repeat bootstrap work.
- Visibility is tracked per attachment. Network live work stays active while at
  least one attachment is visible and pauses when all are hidden.
- The final `close` tears down runtime subscriptions, leases, listeners, and
  cached in-memory windows owned by the shared query.
