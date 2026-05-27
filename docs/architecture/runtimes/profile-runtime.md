# Profile Runtime

## Purpose

Profile runtime owns metadata and authored-note loading for one pubkey.

## Render-Critical Kinds

| Phase            | Kinds                                                      |
| ---------------- | ---------------------------------------------------------- |
| Bootstrap posts  | Author kind `1` and rendered repost kinds                  |
| Live posts       | Same as bootstrap                                          |
| Separate Demands | Kind `0`, `3`, `10002` -- never mixed into post page slots |

## Lazy Hydration

- Header metadata may load via `metadata` purpose Demands on open.
- Reference previews for visible post rows only.

## Cursor Policy

- **Bootstrap posts**: author write routes first, then selected read fallback.
- **Live posts**: `since` from newest visible post.
- **Older / newer**: `page` phase with scan cursor overlap when needed.
  Accidental older calls preserve newest rows. Only downward scroll-bottom
  intent may preserve older rows and expose `hasNewer`.
- Note window cap `180` items.

## Contract

- Profile tabs receive a pubkey from workspace actions.
- Runtime reads cache first, then orchestrator Demands.
- Metadata and follow-list events never consume visible note page slots.
- Future notes and old live replay are stored but not inserted into visible
  profile rows.
- Relay reads use [routing-by-surface](../network/subscription-orchestration/routing-by-surface.md).
- `loadNewer` remains part of the runtime API. Profile UI invokes it through
  automatic profile-card top recovery, not through a visible manual control.
- Older calls are coordinated so repeated near-end callbacks cannot overlap or
  keep pruning newer rows after a stale bottom signal.
- Hidden tabs release live post Demands; metadata Demands may complete if already in flight.
- Close all Demands and abort page reads on tab close.
- Startup rejection paths log one bounded app-log runtime failure for the tab.
