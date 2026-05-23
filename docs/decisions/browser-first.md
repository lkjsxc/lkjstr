# Browser-First Runtime

## Purpose

This decision records why core product behavior runs in the browser.

## Decision

The Nostr workspace client is browser-first. SvelteKit supplies the app shell, but core product behavior must run in the browser with IndexedDB, workers, WebSocket relay connections, and local state.

## Consequences

- The app can be useful without an application server.
- Local cache and recovery behavior are product requirements.
- Browser diagnostics matter as much as server observability would in a hosted system.
- Performance work must consider main-thread pressure and worker offload.
- Cloudflare Workers hosting is allowed as an app-shell target, but the core
  runtime still uses browser storage, browser WebSockets, and local signing
  boundaries.

## Rejected Direction

A required relay proxy or backend service is not part of the core runtime. Such services may be added later for optional workflows, but they cannot be required for reading, composing, relay monitoring, or workspace persistence.
