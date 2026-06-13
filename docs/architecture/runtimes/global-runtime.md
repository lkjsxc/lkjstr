# Global Runtime

## Purpose

Global runtime owns unauthenticated recent-note loading from readable relays.

## Status

`lkjstr-app` and `lkjstr-ui` build and render `GlobalFeedView` rows from real
events, selected-relay live-query input, and explicit no-relay, partial, and
ready states. The Rust browser host now loads selected-relay SQLite cache rows,
requires exact Global coverage before cache-ready, starts bounded
selected-relay reads after partial proof, and proves older-page scroll
ownership, explicit older commands, underfilled-viewport older requests, and
compound older relay cursors. The shipped Global runtime remains TypeScript-owned
until deletion proof closes.

## Render-Critical Kinds

| Phase     | Kinds         |
| --------- | ------------- |
| Bootstrap | Kind `1` only |
| Live      | Kind `1` only |

## Lazy Hydration

- Profile metadata for visible rows only, same cap as Home (`30`).
- No author route expansion Demands.

## Cursor Policy

- **Bootstrap**: one adaptive bounded scan on selected read relays.
- **Live**: `since` from newest accepted kind `1` minus `30` s skew.
- **Older / newer**: `page` phase with compound `{createdAt,id}` cursors.
- Window cap `180` items.

## Contract

- Load cached display-kind notes from the shared repository first.
- Global remains selected-relay based only.
- Cache-first proof and cached page reads must include selected relay provenance;
  events cached only from unselected relays do not render in Global.
- Complete selected-relay coverage returns the SQLite page without relay reads;
  partial coverage reads only uncovered selected relays.
- Do not require an active account.
- Orchestrator Demands for bootstrap then live.
- Hidden tabs release live Demands; retain window until runtime close.
- Abort in-flight page reads on runtime close.
- Startup rejection paths log one bounded app-log runtime failure for the tab.
