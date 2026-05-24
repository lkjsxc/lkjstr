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
- One-shot reads close early at the event cap and report incomplete coverage.
- `AbortSignal` cancels paged reads, closes relay subscriptions, and releases
  read limiter slots.
- Subscription manager handles close live subscriptions and abort in-flight
  reads from `close()`.
- Search, Custom Request, and Author Context tabs close their local
  subscription manager when destroyed.
- Publish OK waiters clear timeout timers when an OK arrives or the timeout
  fires.
- Idle relay pool clients close and leave the client map after a short grace
  period once they have no active subscriptions or publish waiters.
- Relay snapshots are current-session diagnostic history only, keep the most
  recent `100` relays, and are polled only by diagnostics surfaces.
- Profile summaries keep the most recent `1000` pubkeys in memory.
- Relay request compatibility evidence keeps the most recent `250` relays and
  expires after one hour.
- Relay information keeps the most recent `128` NIP-11 records in memory and
  expires after thirty minutes; IndexedDB remains the durable source.
- Relay diagnostic suppression and diagnostic summaries keep bounded memory
  maps and never retain raw relay payloads.
- Feed coverage memory fallback keeps the most recent `500` rows; IndexedDB
  coverage rows are compacted by age and status.
- Reference indexes use bounded maps or time-based expiration.
- Workspace snapshots above the fixed local size cap are rejected before JSON
  parsing, and restored closed-tab history is capped.
- Runtime factories ignore async results and relay events after close.
- Worker handles terminate on result, error, cancellation, and tab destroy.
- UI timers are cleared when their owning row, menu, header, or tab is
  destroyed.
- Tab retention clears timers and closes retained runtimes on replacement,
  expiry, tab removal, pane destruction, and retention disablement.

## Data Safety

Memory cleanup must preserve user-owned IndexedDB data. Do not clear accounts,
local secrets, settings, relay sets, Tweet drafts, workspace state, or cached
events to rebuild derived indexes. Normalize derived rows in place whenever
possible.
