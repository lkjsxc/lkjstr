# Failure Recovery

## Purpose

Failure recovery keeps lkjstr usable when IndexedDB, localStorage, quota, or
schema access fails.

## Startup

On startup, the app attempts to open durable storage. If storage is unavailable,
blocked, corrupt, or too slow, the workspace initializes in memory with Welcome
usable and focused. The root route must not fail because persistence failed.

The degraded session may hold runtime events, workspace state, and settings in
memory only. UI text must not claim durable persistence unless storage results
confirm it.

## Diagnostics

Stats reports degraded storage as explicit status:

- unavailable storage API
- blocked storage
- timeout or late settlement
- corrupt row or unavailable store
- quota failure
- incomplete inventory

Repeated failures should appear in logs or Stats aggregates without blocking
reachable relay reads or local session use.

## Safety

Automatic recovery never deletes protected user data. Missing stores or corrupt
diagnostics are reported first. Destructive repair of protected records requires
a separately designed owner action.
