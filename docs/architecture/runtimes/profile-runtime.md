# Profile Runtime

## Purpose

Profile runtime owns metadata and authored-note loading for one pubkey.

## Render-Critical Kinds

| Phase | Kinds |
|-------|-------|
| Bootstrap posts | Author kind `1` and rendered repost kinds |
| Live posts | Same as bootstrap |
| Separate Demands | Kind `0`, `3`, `10002` — never mixed into post page slots |

## Lazy Hydration

- Header metadata may load via `metadata` purpose Demands on open.
- Reference previews for visible post rows only.

## Cursor Policy

- **Bootstrap posts**: author write routes first, then selected read fallback.
- **Live posts**: `since` from newest visible post.
- **Older / newer**: `page` phase with scan cursor overlap when needed.
- Note window cap `180` items.

## Contract

- Profile tabs receive a pubkey from workspace actions.
- Runtime reads cache first, then orchestrator Demands.
- Metadata and follow-list events never consume visible note page slots.
- Relay reads use [routing-by-surface](../network/subscription-orchestration/routing-by-surface.md).
- Hidden tabs release live post Demands; metadata Demands may complete if already in flight.
- Close all Demands and abort page reads on tab close.
