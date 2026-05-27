# Subscription Manager

## Purpose

The subscription manager sits above the relay pool and multiplexes relay reads.
**Demand planning and shared Leases** live in
[subscription-orchestration/](subscription-orchestration/README.md); this page
covers the manager layer directly below the planner.

## Contract

- The relay pool still owns one WebSocket client per normalized relay URL.
- The manager registers live subscriptions by lease fingerprint and filter shape.
- Identical live reads share one relay subscription and fan events out to each
  listener.
- Logical subscription keys use lease fingerprints. Tab ids and owner handles
  never reach relay-facing ids.
- Relay-facing ids are compact opaque ids before they reach the pool. Long
  profile, thread, older-page, and embed keys must never send ids longer than
  `48` characters.
- Default runtimes use the shared subscription manager through the orchestrator.
  Injected custom relay pools or managers get isolated managers for tests only.
- Cleanup removes one listener; relay `CLOSE` is sent only after the last
  listener is gone.
- One-shot paged reads use the same registration path and close when complete.
- In-flight one-shot paged reads dedupe by normalized relays, filters, lease
  fingerprint, request purpose, and timeout.
- `readPage(request, options)` returns raw relay-provenance receipts. Feed page
  helpers decide event sorting, duplicate merging, and cursor filtering.
- `readPage(request, { signal })` cancels local relay work when the signal
  aborts and returns collected events with abort status metadata.
- Deduped one-shot reads attach every caller signal to the shared abort
  controller. Any caller abort cancels the shared relay work for all attached
  callers.
- Shared read abort listeners are removed when the shared promise settles.
- `readPage` has a default hard cap of `1000` relay events. Callers may pass a
  smaller cap for tighter surfaces.
- Paged reads close on EOSE, terminal relay state, timeout, cap, or abort.
- One-shot relay-facing ids are leased exactly as sent to the pool and released
  in `finally`.
- Paged reads use `backward`; live reads use `forward` per orchestration phase.
- Home, Global, Profile, Thread, and Notifications use the orchestrator for
  relay reads.
- Search, Custom Request, and Author Context use the shared orchestrator with
  isolated Demand owners.

## Orchestration

See [subscription-orchestration/README.md](subscription-orchestration/README.md)
for Demand, Lease, bootstrap/live, routing, and observability contracts.
