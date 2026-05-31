# App Boundary

## Purpose

This file defines the Rust application composition boundary. Status:
design-only.

## Owner

`lkjstr-app` owns browser-local product services. It is not a server backend and
does not introduce remote account state.

## Responsibilities

- Start the workspace root and recover to Welcome when storage is unavailable.
- Own shared Home query state above tab components.
- Own timeline, profile, thread, notification, search, and tool runtimes.
- Coordinate Tweet signing, queueing, drafts, and publish jobs.
- Route UI commands to protocol, relay, storage, and host services.
- Expose compact view models and command results to `lkjstr-ui`.
- Own startup recovery, job recovery, account selection, and settings loading.

## Boundaries

- Pure product state lives in `lkjstr-domain`.
- Protocol validation and signing live in `lkjstr-protocol`.
- Relay scheduling and subscription state live in `lkjstr-relays`.
- Durable storage repositories live in `lkjstr-storage`.
- Browser APIs live in `lkjstr-web`.
- Leptos components live in `lkjstr-ui`.

## Command Contract

Commands return typed results rather than throwing through UI paths. Recoverable
failures become explicit unavailable, blocked, quota, corrupt, timeout, or
canceled states.

App commands do not pass large event objects through component context. They
pass IDs, compact row models, storage keys, and resource-owner handles.

## Cleanup

Every runtime created by `lkjstr-app` has an idempotent close path. Closing a
tab or workspace releases live relay demands, pending reads, timers, workers,
DOM listeners owned through host adapters, and transient memory pins.
