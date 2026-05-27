# Global Runtime

## Purpose

Global runtime owns unauthenticated recent-note loading from readable relays.

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

- Load cached kind `1` notes from the shared repository first.
- Global remains selected-relay based only.
- Do not require an active account.
- Orchestrator Demands for bootstrap then live.
- Hidden tabs release live Demands; retain window until runtime close.
- Abort in-flight page reads on runtime close.
- Startup rejection paths log one bounded app-log runtime failure for the tab.
