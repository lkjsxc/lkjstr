# Subscription Manager

## Purpose

Subscription manager sits above the relay pool and shares relay reads across
runtime surfaces.

## Contract

- The relay pool still owns one WebSocket client per normalized relay URL.
- The manager registers live subscriptions by relay set and filter shape.
- Identical live reads share one relay subscription and fan events out to each
  listener.
- Logical subscription keys are compacted to relay-safe IDs before they reach
  the relay pool. Long profile, thread, older-page, and embed keys must never
  send IDs longer than 64 characters.
- Cleanup removes one listener; the relay `CLOSE` is sent only after the last
  listener is gone.
- One-shot paged reads use the same registration path and close when complete.
- `readPage(request, options)` returns raw relay-provenance receipts. Feed page
  helpers decide event sorting, duplicate merging, and cursor filtering.
- Paged reads close on EOSE from all active relays, terminal relay state, or
  timeout.
- Relay `CLOSED`, EOSE, socket closed, and socket error are terminal for paged
  reads.
- The local de-duplication key may include filters, but the relay-facing id is
  short and opaque.
- Paged reads are used for historical `until` pages; live reads are used for
  current subscriptions.
- Home, Global, Profile, Thread, and Notifications use this layer for relay
  reads.
