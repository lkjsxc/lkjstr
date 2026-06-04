# Resource Ownership

## Purpose

This table lists every resource type, who creates it, who closes it, when it
must close, what it may retain, and what it must never retain.

## Table

| Resource | Creator | Closer | Close Trigger | May Retain | Must Never Retain |
|---|---|---|---|---|---|
| WebSocket client | `createRelayClient` factory | `relayClient.close()` | Pool idle eviction, final pool close, intentional relay removal | Normalized URL, connection state, compact metrics | Raw relay payloads, unbounded diagnostic arrays, historical subscription IDs |
| Relay subscription | `createRelayClient` via pool | Subscription manager `remove` -> `CLOSE` | Last listener removed, read completion, abort, timeout | Relay-facing subscription ID, compact filter summary | Raw events for that sub, historical request keys |
| Paged read lease | `createRelaySubscriptionManager` | Read `finally` or manager `close` | EOSE, terminal state, timeout, abort, event cap | Read result events with relay provenance, read status | Raw subscription manager state, unbounded event arrays |
| Publish waiter | `createRelayPublishWaiters` | `settle`, `settleAll`, or pool close | OK received, timeout fired, pool closed | Event ID, relay URL, compact result | Raw event object after settlement, unbounded waiter maps |
| Abort listener | Shared abort controller or read helper | `finally` block in read/page | Read settlement, abort, timeout, manager close | Signal reference during active read | Signal reference after settlement, closure capturing feed arrays |
| Timer | Any factory or component | Factory `close`, component destroy | Resource no longer needed, owner destroyed | Timer ID until cleared | Timer ID after clear, callback closure after removal |
| Worker | `createWorkerHandle` or component | Factory `terminate`, component destroy | Task complete, owner destroyed | Worker reference during active task | Worker reference after termination, message callbacks |
| Svelte store subscription | Component or runtime | Component destroy, runtime close | Component unmount, tab close, runtime close | Current store value during active subscription | Historical store values, closure capturing large objects |
| DOM event listener | Component action or factory | Action destroy, factory close | Component destroy, pane removal, tab close | Element reference during active listen | Element reference after removal, closure capturing runtime handles |
| IndexedDB transaction | Storage helper | Transaction completion or abort | Operation settled, error, timeout | Operation result during active transaction | Transaction handle in Svelte state, unbounded request handles |
| Feed runtime | `createFeedRuntime` factory | `runtime.close()` | Tab close, pane removal, app reset | Event IDs in bounded window, compact view models | Raw event objects, unbounded arrays, profile maps |
| Tab runtime | `createTabRuntime` factory | `runtime.destroy()` | Tab close, pane removal | Compact snapshot with tab ID and kind | Raw feed arrays, live subscriptions, unbounded timers |
| Closed-tab snapshot | `createSessionTabSnapshots` | TTL expiry or `take` | Retention window exceeded, tab reselected | Compact tab state (ID, kind, scroll position) | Raw events, feed arrays, runtime handles |
| Relay diagnostic summary | `recordRelayDiagnosticSummary` | Bounded map eviction, TTL | Summary cap reached, age exceeded | Compact counters, last event ID, bounded recent diagnostics | Raw relay payloads, unbounded diagnostic history, per-request logs |
| Profile summary cache | `createProfileCache` or bounded map | LRU eviction, TTL | Cap reached, age exceeded | Compact profile fields (name, picture, nip05) | Full profile events, unbounded pubkeys, raw metadata |
| Token/content cache | `createBoundedMap` or factory | LRU eviction, TTL | Cap reached, age exceeded | Token arrays per event content | Raw event objects, unbounded content strings |
| Notification runtime state | `createNotificationsRuntime` | `runtime.close()` | Tab close, pane removal | Notification record IDs in bounded window | Raw source/target events, unbounded notification arrays |

## Rules

- Every factory that creates an effectful resource must return a handle with an
  explicit `close`, `destroy`, or `dispose` method.
- Cleanup must be idempotent. Calling `close` twice must not throw.
- Parent owners must call child cleanup when the parent is destroyed. Tab
  runtimes close their subscription managers; subscription managers close their
  relay subscriptions.
- Counters must use static names. They must not contain tab IDs, request IDs,
  subscription IDs, event IDs, pubkeys, or raw URLs.
- Debug snapshots must be small JSON objects and must not expose secrets, local
  signing keys, drafts, raw events, or raw relay frames.

## Source Module Map

| Resource | Primary source module |
|----------|----------------------|
| WebSocket client | `src/lib/relays/relay-client.ts` |
| Relay subscription | `src/lib/relays/relay-client.ts`, `relay-pool.ts` |
| Paged read lease | `src/lib/relays/subscription-manager.ts`, `subscription-read-page.ts` |
| Publish waiter | `src/lib/relays/relay-publish-waiters.ts` |
| Abort listener | `src/lib/relays/shared-abort-controller.ts`, `read-limiter.ts` |
| Timer | `src/lib/fp/resource-scope.ts`, relay/tab factories |
| Worker | Worker owners in tab or job modules |
| Svelte store subscription | `src/lib/tabs/*`, runtime factories |
| DOM event listener | Tab components, drag actions, popovers |
| Storage operation | `src/lib/storage/operation/`, SQLite worker repositories |
| Feed runtime | `src/lib/timeline/timeline-runtime.ts`, profile/thread runtimes |
| Tab runtime | Per-tab runtime under `src/lib/tabs/` and `src/lib/timeline/` |
| Closed-tab snapshot | `src/lib/workspace/session-tab-snapshots.ts` |
| Relay diagnostic summary | `src/lib/relays/relay-diagnostic-summary.ts` |
| Profile summary cache | Profile hydration modules |
| Token/content cache | Event content token cache |
| Notification runtime state | `src/lib/notifications/` runtimes |

## Reference

- [bounded-memory.md](bounded-memory.md): bounded memory rules.
- [heap-retention.md](heap-retention.md): observed symptoms and investigation
  strategy.
