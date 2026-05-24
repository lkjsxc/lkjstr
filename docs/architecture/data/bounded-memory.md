# Bounded Memory

## Purpose

Bounded memory rules prevent relay and tab sessions from retaining old request
state after the user navigates, closes tabs, or leaves reads unfinished.

## Contract

- Relay clients delete `EOSE`, `CLOSED`, and filter state when subscriptions
  close.
- Paged reads capture terminal relay evidence in the read result before relay
  subscription cleanup removes client-side subscription maps.
- One-shot reads generate unique relay-facing ids without retaining historical
  request-key sets.
- `AbortSignal` cancels paged reads, closes relay subscriptions, and releases
  read limiter slots.
- Subscription manager handles close live subscriptions and abort in-flight
  reads from `close()`.
- Search, Custom Request, and Author Context tabs close their local
  subscription manager when destroyed.
- Publish OK waiters clear timeout timers when an OK arrives or the timeout
  fires.
- Reference, profile, relay snapshot, relay policy, and diagnostic in-memory
  indexes use bounded maps or time-based expiration.
- Runtime factories ignore async results and relay events after close.
- Tab retention clears timers and closes retained runtimes on replacement,
  expiry, tab removal, pane destruction, and retention disablement.

## Data Safety

Memory cleanup must preserve user-owned IndexedDB data. Do not clear accounts,
local secrets, settings, relay sets, Tweet drafts, workspace state, or cached
events to rebuild derived indexes. Normalize derived rows in place whenever
possible.
