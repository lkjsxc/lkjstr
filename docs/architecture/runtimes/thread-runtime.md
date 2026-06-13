# Thread Runtime

## Purpose

Thread runtime owns event root and reply loading.

## Render-Critical Kinds

| Phase             | Kinds                                                        |
| ----------------- | ------------------------------------------------------------ |
| Bootstrap root    | Kind for root event id lookup                                |
| Bootstrap replies | Kinds the thread list renders (`1`, `6`, `16` as applicable) |
| Live              | Reply filter `#e` for root id                                |

## Lazy Hydration

- Reactions and repost counts: visible-row or expanded-row Demands only.
- Rust Leptos reads cached focused/root events and cached replies or focused
  references from worker-owned SQLite, follows bounded cached parent-chain ids,
  then starts bounded relay reads for the root, focused event, parents already
  visible in cache, and replies.
- Root context from cache before relay root Demand.

## Cursor Policy

- **Bootstrap**: `ids` for root, then `#e` reply scan; window cap `240`.
- **Live**: forward `since` from newest reply in window. Rust currently starts
  a bounded live reply read after bootstrap completion.
- **Older / newer**: `page` phase via `e` tag index routes. Rust currently
  wires the explicit older footer command, downward near-end scroll gesture, and
  underfilled viewport probe to one bounded page read before the oldest retained
  Thread row.
- Route hints and receipts before selected-relay widening.

## Contract

- `ThreadRuntime` receives event id, fallback relays, and owner id.
- Load cache first; orchestrator for relay phases.
- Rust host cache proof derives NIP-10 root ids, loads replies by `#e` root or
  focused-event tags, follows bounded cached parent-chain ids, and renders
  display kinds `1`, `6`, and `16`.
- Relay bootstrap, live, and older-page reads merge progressive snapshots into
  the cached window. Bootstrap exact-id filters include parent ids already
  visible in cached Thread rows.
- Terminal parent misses after exact cache and complete relay lookup render
  retryable unavailable-parent rows. Deep reply branches collapse into
  continuation rows that open matching Thread tabs.
- Deletion proof and broader Thread parity remain open.
- Close Demands on tab close; abort queued page reads.
- Hidden tabs release live reply Demand.
- Startup rejection paths log one bounded app-log runtime failure for the tab.
