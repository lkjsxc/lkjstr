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

- **Bootstrap**: local records first, then bounded relay page when cursor exists.
- **Live**: `since` at runtime start for active account read relays.
- **Older**: `page` with `since` and `until` from oldest loaded record.
- Record window cap `180`; prune by record count.

## Contract

- Load local notification records before relay Demands.
- Build relay filters through `notification-filters` (`#p` targeting only).
- Reject self-authored kind `1` without `#p` self tag as notification rows.
- Use active account NIP-65 read relays plus selected read fallback.
- Mark read only when tab is visible and window focused.
- No relay Demands without active account or enabled read relays.
- Hidden tabs release live Demand.
- Close Demands on relay settings change or tab close.
