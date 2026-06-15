# User Timeline

## Purpose

User Timeline shows a public home-like feed for a target pubkey based on that
pubkey's latest real NIP-02 follow list. When the follow graph cannot be found
but target-authored posts are reachable, it may show a clearly labeled degraded
feed of the target's own public posts.

## Entry Points

User Timeline opens from Profile actions, Followees rows, the fixed `lkjsxc`
New Tab item, and future identity-related menus.

Opening User Timeline focuses an existing same-tile tab with the same target
pubkey. If none exists, the workspace creates one in that tile.

## Input

The tab input is:

- target pubkey.
- optional source of `profile`, `followees`, `catalog`, or `manual-action`.

The target pubkey is the subject whose public follow graph is used. The viewer's
active signing account is optional and must not be required for reading.

## Discovery States

The runtime reports explicit states:

```text
not-started
loading-cache
loading-selected-relays
loading-target-routes
loading-nip65-routes
loading-provenance-routes
partial
target-posts-only
incomplete
failed
auth-required
rate-limited
offline
```

Each state carries attempted, successful, failed, and pending route groups;
newest discovered follow-list event id when known; newest known follow-list
created time; reason codes; and retry affordances.

`incomplete` means real route attempts are exhausted, failed, timed out, auth
blocked, or still insufficient for absence proof. It never means that a cache
miss proves the target has no public follow list.

## Relay Route Sources

Discovery uses bounded, deduped route groups:

- selected read relays.
- relays from cached target events.
- profile metadata provenance.
- NIP-65 relay-list metadata for the target when available.
- NIP-02 follow-list event provenance.
- relay hints from event tags and NIP-19 entities.
- local route evidence from previous successful reads.
- previously successful target route groups.
- user-imported relay suggestions only after explicit import when policy
  requires it.

Disabled or removed relays remain excluded until the user restores them. Global
routing rules do not apply; User Timeline is target-scoped.

## Progressive Rendering

User Timeline renders useful real data while discovery continues:

- A cached follow list may render immediately when coverage evidence is
  sufficient; relay refresh still runs.
- Partial followees may render with incomplete diagnostics.
- Fast relay rows render before slow relays finish.
- Pending feed-provider work after discovery renders loading until cached rows,
  progressive relay rows, or terminal relay evidence exists.
- Slow, failed, auth-required, or timed-out relays merge later as diagnostics
  and do not block reachable relays.
- Status, notices, retry controls, and diagnostics are in-flow rows inside the
  feed scroll surface.

The tab labels whose timeline is being shown and must not imply private or
personalized access.

## Header Contract

The leading in-flow row uses the shared feed identity header for the target
pubkey: avatar, display name, and subtitle from hydrated profile metadata. The
header must not show raw `npub` or `Public timeline for npub...` copy.

## Feed Contract

When a latest kind `3` is found, the runtime extracts valid followee pubkeys,
adds the target pubkey, and reads feed-display events from those authors. It
uses the same event row rendering, sensitive-content gate, profile hydration,
paging, height reservation, and bounded runtime rules as Home and Profile.

Author filters are chunked by request budget. A large follow graph must not
create one unbounded filter, duplicate route scan, full-follow-graph fanout, or
unbounded profile hydration queue.

## Target-Posts-Only Degraded Mode

If the public follow graph is unavailable but real target-authored posts are
reachable, the tab renders target-posts-only mode with this notice:

```text
Public follow graph unavailable; showing this user's own public posts.
```

This mode is honest and retryable. It does not synthesize a follow graph, does
not imply that the target follows nobody, and does not hide relay failures.
Retry and route-expansion actions remain available when safe.

## Cache Contract

Cached rows may render before relay results only when coverage evidence supports
the target pubkey, route fingerprint, selected relay fingerprint, author-set
hash, filter shape, page size, feed policy, and time interval. Cached rows for
one target must not appear in another target's timeline unless the author set
and coverage evidence match.

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

Successful discovery evidence is persisted through the correct repository path:
follow-list event id, relay where found, route source, route confidence, newest
created time, last successful discovery time, and bounded failure summaries.
Raw unbounded traces are not persisted.

## Retry And Route Expansion

Safe actions:

- retry failed routes with backoff.
- try selected read relays again.
- try target relay hints and known provenance relays.
- try NIP-65 routes when real metadata exists.
- import suggested relays explicitly where policy requires it.
- open relay diagnostics.

The runtime prevents retry storms, unbounded relay fanout, repeated failed-route
hammering, and use of disabled relays.

## Incomplete Diagnostics

Before showing `incomplete`, the runtime must have attempted or ruled out:

- selected read relays.
- bounded target routes.
- real NIP-65 routes when available.
- real provenance routes from target profile, events, or follow-list receipts.
- cached follow-list evidence and coverage validity.
- target-authored posts for degraded display when selected or target routes are
  reachable.

The UI replaces a bare `Follow-list discovery is incomplete.` with concise
wording that says what was tried, what failed or is pending, whether target-only
posts are available, whether selected relays may be insufficient, whether auth
or offline state matters, and what the user can do next. Structured reason codes
are exposed to Stats and logs.

## Empty States

- Follow-list discovery in progress.
- Public follow graph unavailable; showing this user's own public posts.
- Follow list has no valid authors beyond the target pubkey.
- Relay reads are unavailable, with diagnostics.
- No covered events exist for the current bounded interval.
- No public follow list was found after complete route evidence for attempted
  relays.

Empty states never synthesize users, posts, follow lists, profiles, or previews.
