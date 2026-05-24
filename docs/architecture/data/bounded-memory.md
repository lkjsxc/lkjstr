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
- `AbortSignal` cancels paged reads, closes relay subscriptions, removes queued
  read limiter waiters, and releases acquired read limiter slots.
- Subscription manager close handles live subscriptions, in-flight reads, and
  queued page reads from `close()`.
- Deduped reads remove all attached abort listeners after settlement.
- Search, Custom Request, and Author Context tabs close their local
  subscription manager when destroyed.
- Async Svelte continuations check component liveness before mutating local
  state after tab or row teardown.
- Publish OK waiters clear timeout timers when an OK arrives or the timeout
  fires.
- Relay pool close resolves pending publish waiters, clears idle timers, closes
  clients, drops live handlers, and leaves no live client handles.
- Relay client final close clears reconnect/connect timers, socket handlers,
  queues, request scheduler state, aliases, tombstones, subscription maps, and
  active-id counters.
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
- Timeline, profile-support, notification, relay route, relay suggestion, and
  job fallback stores are bounded in memory. IndexedDB remains the durable
  source when available.
- Reference indexes use bounded maps or time-based expiration.
- Workspace snapshots above the fixed local size cap are rejected before JSON
  parsing, and restored closed-tab history is capped.
- Runtime factories ignore async results and relay events after close.
- Runtime counters use a static key set such as `timeline:home`,
  `timeline:global`, `timeline`, and `subscription-manager`; they must not
  include tab ids or request ids.
- Runtime counter diagnostics are compact counters only and must not retain raw
  relay payloads, event arrays, or per-tab histories.
- Worker handles terminate on result, error, cancellation, and tab destroy.
- UI timers are cleared when their owning row, menu, header, or tab is
  destroyed.
- Tab snapshot retention keeps only bounded session-memory UI state. It clears
  timers and snapshots on replacement, expiry, tab removal, pane destruction,
  and retention disablement.

## Data Safety

Memory cleanup must preserve user-owned IndexedDB data. Do not clear accounts,
local secrets, settings, relay sets, Tweet drafts, workspace state, or cached
events to rebuild derived indexes. Normalize derived rows in place whenever
possible.
