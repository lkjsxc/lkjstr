# System Architecture

## Purpose

System architecture defines browser runtime boundaries and state ownership.

## Runtime Shape

The app is a browser-first SvelteKit client. SvelteKit provides routing, app
shell, build pipeline, and progressive loading. Protocol work, relay connections,
cache access, and workspace state run in browser-owned modules.

## Primary Modules

- Product shell: SvelteKit routes, layout, navigation, settings entry points.
- Workspace UI: pane layout, pane lifecycle, user interactions, visual state.
- Account service: account metadata, signer capability, active identity.
- Protocol kernel: event, filter, message, tag, and validation logic.
- Relay pool: WebSocket connections, subscriptions, publish results, monitor events.
- Cache service: IndexedDB repositories and query helpers.
- Worker bridge: background verification, normalization, indexing, and query fan-out.
- Subscription orchestrator: Demand registry, lease planner, and ingress classification
  between runtimes and the subscription manager.

## Dependency Direction

UI may depend on app services. App services may depend on protocol kernel
and storage interfaces. Protocol kernel does not depend on UI, SvelteKit,
IndexedDB, or WebSocket implementations.

Relay pool depends on protocol message helpers but not on pane components. Pane ownership is passed as data.

Tab and pane components submit **Demands** to the orchestrator. Only the
orchestrator and subscription manager issue `REQ` and `CLOSE`. Runtimes consume
materialized storage and selectors; they do not own raw relay subscription ids.

In `lkjstr`, **backend** means this browser-local orchestration layer, not a
remote server or relay proxy.

## State Classes

- Canonical durable state: accounts, relay sets, workspace layout, drafts, cached events.
- Live operational state: WebSocket status, subscription handles, publish attempts, worker queues.
- Derived state: visible timelines, relay health summaries, validation summaries.

Durable state belongs in IndexedDB. Live operational state belongs in memory and can be rebuilt.

## Failure Boundaries

- Relay failure must not crash workspace rendering.
- Cache failure must degrade to live-only mode with clear user state.
- Worker failure must fall back to main-thread limited operation or surface a bounded disabled state.
- Signer failure must block only actions requiring that signer.
