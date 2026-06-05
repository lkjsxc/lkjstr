# User Timeline

## Purpose

User Timeline shows a public home-like feed for a target pubkey based on that
pubkey's latest NIP-02 follow list.

## Entry Points

User Timeline opens from Profile actions, Followees rows, and future
identity-related menus. It is not a New Tab choice unless a later contract adds
free-form entry.

Opening User Timeline focuses an existing same-tile User Timeline tab with the
same target pubkey. If none exists, the workspace creates one in that tile.

## Input

The tab input is:

- target pubkey.
- optional source of `profile`, `followees`, or `manual-action`.

The target pubkey is the subject whose public follow graph is used. The viewer's
active signing account is optional and must not be required for reading.

## Feed Contract

User Timeline first tries to load the target pubkey's latest kind `3`, extracts
valid followee pubkeys, adds the target pubkey, and reads feed-display events
from those authors. It uses the same row rendering, sensitive-content gate,
profile hydration, paging, and bounded runtime rules as Home and Profile.

Author filters are chunked by request budget. A large follow graph must not
create one unbounded filter, duplicate route scan, full-follow-graph fanout, or
unbounded profile hydration queue. Fast relay rows render early; slow, failed,
or incomplete relays merge later as diagnostics without blocking visible rows.

The tab clearly labels whose timeline is being shown. It must not imply private
or personalized access.

## Degraded Mode

If the public follow graph is unavailable but the target's public posts are
reachable, the tab renders a degraded target-posts-only mode with this notice:
`Public follow graph unavailable; showing this user's own public posts.`

This mode does not synthesize a follow graph and does not imply that the target
follows nobody. It is a truthful fallback for real events authored by the target.

Opening the fixed `lkjsxc` New Tab item uses this same runtime for
`0f38afb23cec30570ee64f9a4aa099229395ec3371c5fe867e09c9111480015d`; see
[workspace tabs](../workspace/tabs.md).

## Relay Routing

Selected read relays are the base and fallback. The runtime may add bounded
protocol-derived routes from target profile metadata, follow-list relay hints,
relay receipts, NIP-65 routes, and local route evidence. Disabled or removed
relays remain excluded.

Global routing rules do not apply. User Timeline is target-scoped.

## Cache Contract

Cached rows may render before relay results only when coverage evidence supports
the target pubkey, route fingerprint, selected relay fingerprint, author-set
hash, filter shape, page size, feed policy, and time interval. Cached rows for
one target must not appear in another target's timeline unless the underlying
author set and coverage evidence match the new target query.

Cache display policy is explicit:

- `coverage-proven`: render cached rows normally.
- `cache-preview`: render one bounded preview page with `Local cache preview
  while relays refresh`.
- `hold-cache`: delay cached rows that would create misleading dominance from
  one author, stale route, or mismatched author set.
- `relay-refreshing`: start relay reads immediately.
- `complete`: promote or replace preview rows only after coverage proof exists.

A cached follow list may render immediately while relay refresh runs. A newer
relay kind `3` replaces it. Older relay results do not erase a newer cached
follow list. Partial relay failure does not clear cached rows.

## Empty States

- Follow-list discovery in progress.
- Public follow graph unavailable; showing this user's own public posts.
- Follow list has no valid authors beyond the target pubkey.
- Relay reads are unavailable, with diagnostics.
- No covered events exist for the current bounded interval.
- No public follow list was found on attempted relays.

Empty states never synthesize posts or profile data.
