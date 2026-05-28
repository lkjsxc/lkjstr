# Notifications Runtime

## Purpose

Notifications runtime owns active-account notification indexing and relay
backfill.

## Render-Critical Kinds

| Phase            | Kinds                                                     |
| ---------------- | --------------------------------------------------------- |
| Bootstrap / page | `0`, `1`, `6`, `7`, `16`, `9735` with active-account `#p` |
| Live             | Same set with `since` on start                            |

## Lazy Hydration

- Target/root context from repository first; relay fetch only for missing refs
  tied to visible notification rows.
- Source rows are canonical; fallback rows labeled in UI.

## Cursor Policy

- **Initial**: local newest records first, then the adaptive grouped scanner
  starts from a one-minute segment with an explicit `(since, until)` interval
  computed from runtime start.
  - `since = max(0, runtimeStartedAt - adaptiveSegmentSpan)`
  - `until = runtimeStartedAt + notificationClockSkewSeconds`
  - The initial relay filter must include both `since` and `until`.
  - Relay behavior is not perfectly reliable: relay events outside the
    requested `(since, until)` must be discarded before persisting.
- **Live**: relay reads use `since = runtimeStartedAt` for the active account
  read relays.
- **Older**: older relay reads keep an independent `olderCursorCreatedAt`. The
  cursor starts at the oldest retained record and moves earlier across complete
  sparse relay windows even when no visible record is added.
  - Let `cursor = olderCursorCreatedAt`
  - `since` comes from the active adaptive segment.
  - `until = max(0, cursor - 1)`
  - Empty complete windows move `olderCursorCreatedAt` to `since` and remain
    retryable until exhaustion is proven.
  - When the initial relay page yields zero records, `olderCursorCreatedAt`
    starts at the initial `since` bound. The UI treats
    `olderCursorCreatedAt !== undefined` as the paging readiness signal.
- Record window cap `180`; prune by record count.

## Exhaustion

Notifications mark `historyExhaustion: 'proven'` only when the scan reaches the
lower bound, local cache has no older records, and every contacted relay read is
complete without timeout, abort, auth, socket, close, or event-limit ambiguity.
Incomplete relay reads keep exhaustion unknown so later scrolls can retry.

## Viewport Fill

- Empty retryable states still render the shared `FeedScrollSurface` and the
  footer row from `notificationViewRows([])`.
- Automatic viewport-fill may issue at most four zero-record older requests per
  runtime intent while the list remains underfilled.
- After the automatic cap, older scans continue only through a current downward
  scroll-owner gesture or the explicit notification footer command.

## Contract

- Load local notification records before relay Demands.
- Build relay filters through `notification-filters` (`#p` targeting only).
- Reject self-authored kind `1` without `#p` self tag as notification rows.
- Use active account NIP-65 read relays plus selected read fallback.
- Use the shared adaptive grouped scanner for bootstrap and historical relay
  pages. Dense or incomplete windows must not prove history exhaustion.
- Mark read only when tab is visible and window focused.
- No relay Demands without active account or enabled read relays.
- Hidden tabs release live Demand.
- Close Demands on relay settings change or tab close.
- Startup rejection paths log one bounded app-log runtime failure before any
  visible-read continuation.
