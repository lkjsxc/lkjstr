# Owner wishes (2026-11-15)

## Purpose

Record the owner decisions, their implementation and verification boundaries.

## Contract

The frontend owns protocol 5. `their-home` takes a `pubkey` or `ref` as the
follow-list owner, independently of the acting `account`. The engine requests
that owner's kind 3 and maintains a feed of those follows. An empty or unknown
list cannot widen into Global. It works signed out and uses ordinary filters.
Its owner profile is requested separately to keep the tab title current. The
kind-3 watch remains live after EOSE while that Home is visible; it reopens a
previously completed lookup and releases on hide/close. On constrained relays,
it shares slots with live feeds after EOSE using the channel rotation cooldown,
including when its filter is shared with account discovery. Finite timeline
requests can also interrupt a settled watch. Routing is unchanged.

`people` serves six local prefix matches, ranked by follows, participants of
`id`'s thread, then the device directory. Matching uses NFKC and lowercase over
display name, name and NIP-05. `authors` instead requests up to 32 profiles;
`ref` explicitly resolves a person, including an opt-in NIP-05 lookup. Directory
scans are bounded by 6000 retained metadata events. Explicit empty text gives a
bare @ up to six suggestions from the retained reply or quote conversation
and the active account's follows. The target author and other participants
precede follows. The active account is excluded, and visible candidates can
load metadata even when only their public keys are known. Queries release on dismiss,
visibility changes or unmount. The frontend requests all device account profiles
at startup and when the device account set changes; fetch priority is unchanged.

`Draft.mentions` carries selected UTF-16 text ranges and their exact labels.
The engine validates ranges and labels, expands them to canonical nostr npubs,
and derives p tags through lkjstr-protocol. Valid standalone pasted npub and
nprofile addresses get a nostr prefix, preserving nprofile relay hints and
leaving malformed text and ordinary URLs intact. Edits dissolve stale ranges. The mock serves
the same sources and mention representation.

`Author.profileId` identifies kind 0 so a failed picture can be tried again on
new metadata, even if its URL is unchanged. Account replies carry the complete
author view model. Public device account faces are remembered; metadata-less
startup responses do not erase them. Faces already drawn update in place.

## Reactions and notifications

Reaction aliases are grouped before rendering: plus, empty and heart are one
like; minus is a thumbs-down. Removing a like deletes all own retained aliases.
The heart action counts likes; other emoji keep their own chips.

Notifications previously bypassed the grouped row projection for fresh counts.
They now count the same filtered, grouped rows they display, excluding own acts.
Every feed uses the same pill. Pressing it or scrolling to the top clears it.
It is offered only below the top: at the top rows arrive by themselves.
Notification read marking updates unread classes without replacing the row.
Account unread counts use the same projection.

A busy feed can move a row just as the reader presses Like, Repost or Zap.
A proposed rule is to hold the list while the pointer rests on a button or
link within a row, counting arrivals in the pill as with keyboard selection.
The list would resume following the head when the pointer leaves.

Read marks record the newest known notification timestamp and all ids at that
timestamp. This avoids losing arrivals within the same second or leaving future
clock-skewed rows permanently unread. At most 6000 tied ids per device account
are stored with the engine's accounts and restored with them. Removing an
account releases its tied ids.

## Fields and posting

Filter redraws defer while an input owns the keyboard. Complete valid periods
apply without formatting the active input; invalid and partial text stays as
typed. Field draft strings survive subsequent bar redraws. People chips update
beside their input. Settings controls already update in place; Enter commits
numeric controls, and list fields commit on blur as well as submission. Query
blur and Enter flush only changed text; an unchanged field does not reopen a feed.

Post, reply and channel use one outbox. It saves the complete outgoing draft
before clearing and focusing the field, before calling any signer. There can be
20 pending or failed drafts per composer. Each line has delivery state and
failure, Retry, Edit and discard. Reloaded unsettled sends wait for an explicit
retry, avoiding an automatic duplicate. Editing into a nonempty field offers
to retain the current draft below before restoring the chosen one. The swap
can transiently retain 21 drafts. Outbox persistence is independent of the input
so an old send completing after remount cannot overwrite newly typed text.
A failed durable write keeps the draft in its field and does not publish it.
Uploaded attachments and selected mention ranges travel with the saved draft.
A failed Edit restoration keeps the outgoing draft after retaining the input.
Closing a tab captures its input and companion outboxes for explicit reopening;
a fresh tab clears all those keys. Outbox identities prevent late sends from
recreating deleted state or overwriting a reused instance. Mention and pasted
address requests close on hide, reopen on show and release on unmount.

## Verification

Native tests cover alias grouping/deletion, another owner's changing follows,
empty-list isolation, ranked kana-width mentions, UTF-16 validation, filtered
notification fresh counts and same-second read marks across restoration.
Frontend tests cover focused field identity/selection, IME, mention edits,
immediate reply/channel input release, complete failure editing, storage refusal
and in-place picture fallback/retry.

Both product smokes run owner-wish scenarios. They type individual characters
with pauses while actual engine updates arrive, checking value, node identity,
focus and both caret endpoints after each. They cover query, period, people,
settings search, relay and server fields. Signer checks cover pending extension
and remote signers as well as failures/reload. Browser captures named wish-N
cover reactions, mentions, notifications and action spacing at 1440 and 390 dark.

All browser fixture traffic is local. Gates use fresh loopback ports, worktree
caches and at most four jobs. The exact run results and remaining limits belong
in the untracked tmp/wishes-report.md, not a historical gate claim here.
