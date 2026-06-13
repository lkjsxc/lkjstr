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
- Profile post pages run the cache-first page planner with the profile route
  fingerprint before relay reads. Complete route coverage returns the SQLite
  page without relay reads; partial coverage renders cached posts and reads only
  uncovered profile route requirements.
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

## Current Rust Evidence

The first Rust Profile slice builds `ProfileFeedView` note rows from the shared
feed row model and renders injected real authored notes in the Leptos Profile
tab. Missing pubkey, missing selected relays, and partial coverage are explicit.
The Rust host provider now reads SQLite authored display-kind rows through
selected-relay fallback or target author routes, promotes cache-ready only from
exact Profile coverage proof, starts bounded relay reads after partial proof,
excludes kind `0` and kind `3` rows from visible notes, renders cached kind `0`
header metadata plus known or unknown kind `3` follow-count state, and releases
owner cleanup on tab switch. Recent complete-empty coverage now scans older
sparse history instead of rendering empty, and only contiguous exact empty
coverage down to the floor renders terminal empty. A separate header relay read
requests kind `0`/`10002` metadata through author routes or selected fallback,
requests kind `3` follow lists through selected relays, stores accepted events
in worker-owned SQLite, and rebuilds the cached header. Known following-count
clicks open or focus Followees, and Profile header actions open or focus User
Timeline for the viewed pubkey. Own-profile actions open or focus Profile Edit.
The Rust copy menu copies npub, nprofile, follow-list JSON, and relay-set JSON
through the host provider before showing copied status. Follow/unfollow actions
publish local or NIP-07 kind `3` updates only after relay acceptance. Deletion
proof remains open.
