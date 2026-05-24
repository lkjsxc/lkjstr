# Subscription Manager

## Purpose

Subscription manager sits above the relay pool and shares relay reads across
runtime surfaces.

## Contract

- The relay pool still owns one WebSocket client per normalized relay URL.
- The manager registers live subscriptions by relay set and filter shape.
- Identical live reads share one relay subscription and fan events out to each
  listener.
- Logical subscription keys are compacted to opaque relay-safe IDs before they
  reach the relay pool. Long profile, thread, older-page, and embed keys must
  never send IDs longer than 48 characters.
- Default runtimes use the shared subscription manager. Injected custom relay
  pools or managers get isolated managers.
- Cleanup removes one listener; the relay `CLOSE` is sent only after the last
  listener is gone.
- One-shot paged reads use the same registration path and close when complete.
- In-flight one-shot paged reads dedupe by normalized relays, filters, logical
  request key, request purpose, and timeout.
- `readPage(request, options)` returns raw relay-provenance receipts. Feed page
  helpers decide event sorting, duplicate merging, and cursor filtering.
- `readPage(request, { signal })` cancels local relay work when the signal
  aborts and returns collected events with abort status metadata.
- `readPage` has a default hard cap of `1000` relay events. Callers may pass a
  smaller cap for tighter surfaces.
- Paged reads close their relay subscription early when the event cap is
  reached. Status metadata marks that relay coverage as incomplete.
- Paged reads close on EOSE from all active relays, terminal relay state, or
  timeout.
- Relay `CLOSED`, EOSE, socket closed, and socket error are terminal for paged
  reads.
- Paged reads close relay subscriptions and release limiter slots on EOSE,
  terminal relay state, timeout, abort, manager close, or thrown errors.
- The local de-duplication key may include filters, but the relay-facing id is
  short and opaque.
- Runtime listeners receive the logical key again even when the relay sees a
  compact ID.
- One-shot relay-facing ids are unique while active without retaining an
  unbounded history of old request keys.
- Paged reads are used for historical `until` pages; live reads are used for
  current subscriptions.
- Home, Global, Profile, Thread, and Notifications use this layer for relay
  reads.
- Search, Custom Request, and Author Context create local managers and close
  them when their tab component is destroyed.
