# Retention Score Policy

## Purpose

Score policy defines how local cache resources earn priority and which records
are immune from eviction.

## Protected Classes

These never evict through score compaction:

- Accounts, local signing secrets, settings, relay sets, Tweet drafts, and
  workspace layout.
- Current workspace tab snapshots and mounted tab state needed for recovery.
- Pending or running jobs.
- User-owned relay safety/configuration state.
- Latest kind `0` metadata per pubkey present in cache.
- Latest kind `3` follow list per active account pubkey.
- Pinned event ids from the runtime pin store while their owner is open.
- Events with a real product-owned `forceProtected` priority row.
- Latest retained notification window per account.
- Unread recent notifications unless emergency pressure has no lower-value
  candidates left.
- Notifications visible in mounted Notifications surfaces.
- Feed keys owned by open Home, Global, Profile, Thread, Notifications, or safe
  Custom Request surfaces.

Older kind `0` metadata and older kind `3` follow-list events may receive high
scores, but they are not permanently protected only because of their kind.
Notifications and feed/page rows are not globally protected user data.

## Event Scores

Score combines recency, kind, structural source, and direct target value:

- Recency bucket from event `created_at`.
- Kind weight for metadata, follows, notes, reposts, reactions, and zaps.
- Structural source weight for `e`, `q`, and `p` tags on the event.
- Target bumps for directly referenced `e` and `q` events from replies,
  quotes, reposts, reactions, and zaps.

Runtime visible pins are consulted dynamically during compaction. They are not
persisted as durable `protected` rows.

## Notification Scores

Lower scores delete first:

- Hidden, muted, or old read notifications.
- Read reactions and reposts.
- Read profile references.
- Read mentions, replies, quotes, and zaps.
- Unread reactions and reposts.
- Unread mentions, replies, quotes, and zaps.
- Notifications in the newest retained window per account.
- Notifications visible in an open Notifications tab.
- Notifications with active unresolved source-event dependency.

Scores use account pubkey, creation time, read time, muted/hidden state, kind,
and visible-surface protection. Deleting a notification does not delete its
source event unless the event is separately selected.

## Feed and Page Scores

- `feedScanHints` are low priority, stale after `30` days, and delete before
  most cache resources.
- `feedCoverage` is medium priority when fresh and complete. Dense,
  incomplete, unresolved, failed, compacted, or stale rows score lower.
- `feedCursors` are medium priority for open feed keys and low priority for
  stale or closed feed keys.
- Stale `tabStates` for absent tabs are low priority. Active workspace
  snapshots remain protected.

Missing feed coverage never proves absence and never suppresses relay reads.
Deleted page cache only causes relay reads to recover evidence naturally.

## Diagnostics, Relay Info, Routes, and Jobs

- Relay diagnostic summaries are low-priority recoverable diagnostics.
- Relay information documents and relay list suggestions are medium-priority
  recoverable protocol cache.
- Author relay routes are medium priority when fresh and lower when stale.
- Relay route blocks are protected only when they represent user-owned blocked
  relay intent. Recoverable route diagnostics are prunable.
- Finished successful jobs are low priority after a short retention window.
- Failed jobs score slightly higher for diagnostics. Pending and running jobs
  are protected.

## Tie Break

When scores tie, keep the newer resource, then the lexicographically greater
ledger id.

## Initial Score

Newly written cache rows receive a baseline score from resource kind and owner
context. Structural updates add weighted increments defined in implementation
modules as pure deterministic functions.
