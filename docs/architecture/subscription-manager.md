# Subscription Manager

## Purpose

Subscription manager sits above the relay pool and shares relay reads across
runtime surfaces.

## Contract

- The relay pool still owns one WebSocket client per normalized relay URL.
- The manager registers live subscriptions by relay set and filter shape.
- Identical live reads share one relay subscription and fan events out to each
  listener.
- Cleanup removes one listener; the relay `CLOSE` is sent only after the last
  listener is gone.
- One-shot paged reads use the same registration path and close when complete.
- Home, Global, Profile, Thread, and Notifications use this layer for relay
  reads.
