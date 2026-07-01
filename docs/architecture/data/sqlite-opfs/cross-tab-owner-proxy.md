# Cross-Tab Owner Proxy

## Purpose

This design-only note records the conditions for proxying SQLite OPFS requests
from a secondary tab to the tab that owns the persistent worker.

## Current Implemented State

The app uses an origin Web Lock before constructing the dedicated SQLite worker.
When another tab holds the lock, the secondary tab does not open a second
persistent worker. It reports a busy storage state, applies a bounded retry
cooldown, and may show the ephemeral holder id learned from BroadcastChannel
owner pings.

## Design-Only Proxy Target

A future proxy may use `BroadcastChannel` only after focused tests and redaction
review prove these requirements:

- The owner tab accepts typed repository operations, not raw SQL from another
  tab.
- Requests carry bounded ids, deadlines, and cancellation messages.
- Responses carry typed storage outcomes and never signing secrets.
- The owner refuses unknown database names, worker URLs, schema hashes, and
  product keys.
- Secondary tabs keep showing read-only or storage-busy UI while proxy setup is
  pending or denied.
- Owner shutdown, pagehide, release, stale response, timeout, and crash paths
  resolve every pending request exactly once.
- Proxy diagnostics dedupe repeated owner-busy failures and expose retry timing.

## Not Implemented

Cross-tab request proxying is not implemented. The safe fallback remains a
single clear storage-busy state plus bounded retry guidance. No product surface
may treat proxy absence or owner busy as empty account, relay, draft, cache, or
notification evidence.
