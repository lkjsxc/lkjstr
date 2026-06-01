# Host Boundary

## Purpose

This file defines how Rust code talks to browser APIs. Status: implemented for
the protocol WASM bridge, partial Leptos shell mount, IndexedDB adapters,
NIP-07 public-key connection, typed SQLite worker host glue, and the first
relay WebSocket plus timer adapter foundation; design-only for remaining
extension adapters.

## Browser APIs

`lkjstr-web` owns direct use of `wasm-bindgen`, `web-sys`, and `js-sys`.
The implemented protocol bridge uses `wasm-bindgen` and structured
`JsValue` responses. The implemented UI host path uses a WASM start hook to
mount `lkjstr-ui` into the browser document. Browser adapters cover:

- WebSocket. The relay host adapter owns `web_sys::WebSocket`, stores open,
  message, error, and close closures in the socket handle, detaches them during
  close, and maps constructor or send failures into typed host problems.
- IndexedDB while current storage paths remain.
- SQLite storage worker. A static `/sqlite-opfs-worker.js` entry loads official
  SQLite WASM assets from `/sqlite/`. A temporary TypeScript worker/client
  exists, and the Rust `lkjstr-web` adapter owns typed requests, deadlines,
  cancellation, close, and late diagnostics. Product wiring is still pending.
- BroadcastChannel and Web Locks for storage ownership.
- Fetch.
- Clipboard.
- File and Blob APIs.
- Timers. The relay host timer owns one browser timeout, clears it on explicit
  cleanup or drop, and keeps callback ownership inside the handle.
- DOM event listeners.
- Browser storage estimates.
- Local storage and session storage.
- NIP-07 extension access. Current Rust support calls `window.nostr`
  `getPublicKey`, validates the pubkey, and stores a signing account; event
  signing is still pending the Rust publish path.
- Workers, including storage-worker cancellation and cleanup.

Production hosting for the primary SQLite OPFS path must emit COOP and COEP
headers so `SharedArrayBuffer` is available to SQLite WASM. Header verification
belongs in operations checks, not in tribal deployment knowledge.

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
