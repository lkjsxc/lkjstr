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
- Root context from cache before relay root Demand.

## Cursor Policy

- **Bootstrap**: `ids` for root, then `#e` reply scan; window cap `240`.
- **Live**: forward `since` from newest reply in window.
- **Older / newer**: `page` phase via `e` tag index routes.
- Route hints and receipts before selected-relay widening.

## Contract

- `ThreadRuntime` receives event id, fallback relays, and owner id.
- Load cache first; orchestrator for relay phases.
- Close Demands on tab close; abort queued page reads.
- Hidden tabs release live reply Demand.
- Startup rejection paths log one bounded app-log runtime failure for the tab.
