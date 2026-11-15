# Channels

## Purpose

Engine implementation of the frontend-owned protocol 4 channel contract.
The frontend protocol and mock remain unchanged.

## Served requests

1. Startup advertises protocol 4, including channel source and action support.
2. Channels list joined kind-10005 e tags in order, then other cached kind-40
   channels by last message time. All-word name/about search is local. Hex,
   note and nevent references fetch the creation event, retaining relay hints.
   Unknown references start with an unnamed header; known nonchannels disappear.
   The finite list reports done after relay responses.
3. Channel windows show a stable header followed by root-tagged kind-42 messages.
   Existing rich filters, ordinary mutes, anchors, fresh counts and timestamp
   paging apply. Creation/update relays and nevent hints supplement read relays.
4. Ordinary feeds exclude kind 42. Bookmarks, threads, quotes and notification
   notes support channel messages. A channel root is never a thread ancestor.
5. Drafts explicitly select or inherit the reply's channel. Root/reply relay
   hints, parent-author tags, media, warning, emoji, quote and client tags use
   existing publication paths. Pending messages become confirmed after delivery.
   Reactions, generic reposts, bookmarks, deletion and ordinary mutes work by id.
6. Join/leave signs and persists kind 10005. Public edits preserve other tags
   and opaque content. Seen marks stay on the device in account storage. Unread
   counts other authors after the mark for joined channels, capped at 99.
7. Creation signs kind 40 with write relays, then signs a joined-list update.
   Its single result waits for both publications and returns the creation id.
   Editing signs kind 41 only for the creation's author; blank names reject.
   Latest creator metadata wins, with ascending id breaking timestamp ties.

## Bounds and lifetime

Events use the existing 16000 regular / 4000 replaceable memory caps and
20000-event physical retention. Channel metadata is derived from that store,
without a separate unbounded cache. List projection uses at most 6000 creations;
metadata/message discovery targets at most 1000 channel ids in 120-id batches.
Metadata and messages use separate requests, each limited to 200 events, so
newer messages cannot displace metadata. Notification repost filters include
both kind 6 and generic kind 16 reposts. Pending visible-count lookups can
interrupt settled channel work so extra metadata requests cannot starve them.
Discovery of channel lists and messages follows visible views and releases on
hide/close. Identical filters share requests. Finite reference lookups can
interrupt settled live subscriptions and release their slots at EOSE.
Competing channel work rotates with a one-second cooldown on constrained relays.
Completed page coverage and response progress survive these interruptions.
Existing inclusive timestamp paging avoids gaps at ordinary timestamp ties;
a full page consisting entirely of one timestamp remains honestly unexhausted.

The scheduler retains its 24-route transport bound and eight hints per view.
Seen marks and notification watermarks share a 4096-entry device bound. Account
removal clears its marks. At most 64 two-event creates can be in flight; signer
and publication deadlines release their bookkeeping on failure.

An early create or join owns a kind-10005 lookup while the existing list is
unknown. Up to 64 edits wait at most 20 seconds, then fail without signing if
the lookup cannot establish the list or its absence. Completion and timeout
drop the lookup wants. Four native regressions cover early create/join, opaque
list preservation, refused/unanswered lookups, expiry, release and the bound.

Kinds 43/44 and encrypted joined lists are not requested. Profile inclusion of
channel messages is optional and remains excluded. Channel word search does not
require NIP-50: it filters discovered and stored channel metadata.

## Verification

Native channel regressions cover list ordering, references, metadata authority,
filters, unread marks, feed separation, notifications, bookmarks, thread ancestry,
publish tags, fake-relay timestamp paging and finite-lookup slot preemption.
The loopback Worker suite exercises all seven requests, including 230 messages
with timestamp ties, live/anchored arrivals, two-event create, pending delivery,
creator edits, mute/delete, unread and fresh-device joined-list recovery.
Current gate results are recorded in verification.md.

The shipped UI smoke in web/scripts/smoke-channels.mjs opens Channels, creates
and edits a channel, leaves and rejoins, opens it from the list, posts, replies
from Thread, switches the client tag off through Settings and opens Stats.
All publications go to the loopback fixture. Worker conformance separately
checks early join without a view and the disabled client tag on kind 42.
No interface wording, style or layout
changes are required; the reply smoke selects the existing Reply button.
