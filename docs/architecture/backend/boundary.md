# Backend Boundary

## Purpose

Define what backend means in this browser-first app.

## Contract

- Backend means a browser-local orchestration boundary, not a hosted relay proxy,
  account service, or remote cache adapter.
- Tabs render snapshots and submit actions. Backend query services own shared
  network work, storage reads, hydration, cleanup, and visibility policy.
- IndexedDB, relay clients, subscription orchestration, and runtime registries
  remain local to the browser process.
- Backend services must expose explicit `close` paths and keep live relay work
  refcounted by attachment ownership.
