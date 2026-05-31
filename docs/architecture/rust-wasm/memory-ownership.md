# Memory Ownership

## Purpose

This file defines Rust/WASM resource cleanup rules. Status: design-only.

## Resource Owners

Every resource has one owner:

- relay clients.
- relay subscriptions.
- pending page reads.
- queued read waiters.
- publish waiters.
- IndexedDB operations.
- WebSocket callbacks.
- DOM event listeners.
- timers.
- workers.
- runtime caches.
- scroll owners.
- dynamic cache-protection pins.

## Cleanup Rules

- Closing a parent closes child resources.
- Cleanup is idempotent.
- Pending reads can be canceled.
- Timers are cleared.
- DOM listeners are removed.
- WebSocket callbacks are cleared.
- Workers are terminated or returned to a bounded pool.
- Long-lived collections declare a cap, time-to-live, owner, or eviction rule.
- Runtime counters use static aggregate keys.
- Debug output never exposes local secret material.

## WASM Callback Rule

Rust closures passed to JavaScript are retained only by explicit owner handles.
Dropping the owner releases the callback and any captured state.

## Budgets

Memory budgets remain those documented in
[../data/heap-retention.md](../data/heap-retention.md). Rust/WASM code must
reduce retained browser objects without hiding leaks behind the WASM heap.
