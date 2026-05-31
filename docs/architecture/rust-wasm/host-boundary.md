# Host Boundary

## Purpose

This file defines how Rust code talks to browser APIs. Status: design-only.

## Browser APIs

`lkjstr-web` owns direct use of `wasm-bindgen`, `web-sys`, and `js-sys`.
Adapters cover:

- WebSocket.
- IndexedDB.
- Fetch.
- Clipboard.
- File and Blob APIs.
- Timers.
- DOM event listeners.
- Browser storage estimates.
- Local storage and session storage.
- NIP-07 extension access.
- Workers.

## JavaScript Boundary

JavaScript remains minimal host glue. It may load the WASM module, expose
browser objects, run Playwright, run Wrangler, and support toolchain commands.
It does not own product reducers, protocol parsing, relay orchestration, or
storage rules.

## Adapter Shape

Host adapters return handles with explicit cleanup:

- `close` for WebSockets and subscriptions.
- `cancel` for pending reads and jobs.
- `clear` for timers.
- `remove` for DOM listeners.
- `terminate` for workers.

Callbacks are stored in owners and dropped during cleanup. `Closure::forget` is
not allowed in product paths unless another owner documents and frees the
callback.

## Error Boundary

Adapters translate browser failures into typed app results. UI code receives
structured unavailable, blocked, timeout, quota, corrupt, late-settled,
late-rejected, or canceled states instead of raw JavaScript exceptions.
