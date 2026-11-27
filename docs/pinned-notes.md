# Pinned notes

## Purpose

Protocol 18 reads public NIP-51 kind-10001 lists and lets a writable account pin or unpin its own kind-1 notes.
Profile renders those notes in a separate section above its chronological feed. Local native/Worker and frontend
gates plus the real build pass; lead-owned browser verification and Claude copy/visual review remain before release.
The interface contract is [P3](interface-profile.md#p3-pinned-notes).

## Public list selection

The verified store selects the newest kind-10001 event for the owner by `created_at`; equal timestamps select
its lowest lexicographic event ID, independently of relay arrival order. These are the replaceable-event rules
in [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md).

Only valid public `e` tags contribute members. Their first occurrence supplies display order, with duplicate
IDs shown once. Invalid references and other tags do not become rows. An owner's opaque content is never
opened as part of this public read; signed-in, signed-out and other-person profiles use the same public list.
See [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md).

A pin reference can resolve to an openable public event even when another client placed it in the list. The
local Pin command is narrower: it adds only a verified kind-1 event authored by the acting account.

## Editing and Undo

`pin {as,id,on}` changes one membership in the latest verified list for `as`:

- Pin keeps existing tag order, relay hints, unknown tag fields and opaque content, appending an `e` tag only
  when that ID is absent. Pinning an existing member does not replace its extended tag.
- Unpin removes matching public `e` tags and keeps every other tag and the content. It needs a valid ID but
  no cached target body; a deleted or evicted target can still be removed from this account's list.
- Undo sends the inverse membership operation against the latest list. It does not replay a saved list, so
  other entries added by another device between the action and Undo survive. Re-pinning still requires the
  verified owned kind-1 target; a missing target produces a failure rather than a fabricated success.

When no list is cached, a write waits for verified read evidence instead of assuming the list is empty.
Successful untruncated absence evidence permits creating an empty base; an unanswered lookup cannot. The
pending action owns its read work and fails after its bounded 20-second wait if no safe base becomes available.

Kind 10001 serializes signing per account and kind. Each prepared edit captures the base event ID, including
absence, and checks it again after signing. A newer list, an equal-time winning replacement, or removal of that
base rejects the old signature as `stale-list`. Another outstanding edit returns `list-edit-pending`.
The write timestamp is newer than the cached base; a maximum timestamp cannot wrap. Delivery remains subject
to the existing publication result and relay receipts.

## Queries, live updates and release

`source: 'pins'` takes the profile owner's `pubkey` or public profile `ref`, plus an optional reader `account`.
It is a finite source in public tag order. The ordinary `profile` source keeps its chronological note/repost
selection, reading anchors and time rail; pin placement never changes those positions.

Visible Profile and Pins views request the owner's kind-10001 list. Account metadata discovery also includes
kind 10001, and visible account-scoped reads keep the account's pin state fresh even when a list is cached.
These are live list subscriptions, so a replacement updates membership, placement and ordinary note menus.
Each request has a view, account or pending-action owner. Hiding or closing a view removes its ownership;
shared work can remain while another legitimate owner still needs it. The frontend opens the paired query
with initial visibility off, then activates it only when its profile is visible, avoiding a hidden-view read
between query admission and the first visibility update.

Missing public targets are fetched by ID through the normal read planner. Selected pinned rows reuse note
hydration for authors, quotes, counts and deletion evidence. Terminal deletion/expiry evidence does not create
another missing-ID request. Valid list relay hints are deduplicated and limited to eight; ID filters use the
existing 120-ID chunks. Temporary list collections are bounded by the stored event payload.

## Display, status and snapshots

Pinned notes use the normal note renderer, with a quiet `note.pinned` context line and a thin separator above
the section. The section scrolls with the profile header. It has no separate chronological rail. Initial
rendering asks for 20 notes; subsequent pages retain one boundary note, at most 21 rows, with explicit Previous
and Next links. Moving between pages does not grow a retained history inside the header.

`NoteRow.pinned?` marks this placement. `NoteRow.mine.pinned?` independently records whether the active account
has pinned that ID, including on ordinary chronological rows. Public snapshots exclude rows marked with pin
placement; ordinary profile snapshots keep their chronological anchor and may retain the account membership
field until fresh engine rows replace it. A cached display never authorizes a list write.

`SubState.pins? {pending,unavailable}` describes referenced events separately from relay phase. Receiving a
kind-10001 list can make the read live while its notes are still pending. Those references retain a loading
line, including when no note is drawn yet. Completed or failed lookups without a usable event show the
unavailable line. A failed list read shows its failure; only a settled empty list hides the section.

Header metadata redraws detach and reseat the intact pins section before the outer row is disposed. This
preserves note bodies, audio handlers, previews, folds and focused controls. In-memory pin positions retain
the visible note through hydration and height changes; explicit paging starts at the first returned note.
The ordinary feed keeper still owns chronological positions below the section. Preview proximity uses the
actual feed viewport and keeps pin and chronological request owners separate. Visibility changes pause audio
and update read ownership; account changes reopen the finite query, and disposal releases its listeners.

## Interface keys and compatibility

Protocol 18 is required for the pins query and Pin/Unpin menu. The More menu offers the action only for the
active writable account's kind-1 note; success offers Undo bound to that same account. Switching accounts
cannot redirect an old Undo. Failure uses the existing action failure path without a success toast.

Both English and Japanese tables contain `act.pin`, `act.unpin`, `note.pinned`, `undo.pinned`, `undo.unpinned`,
`pins.previous`, `pins.next`, `pins.loading`, `pins.failed`, `pins.unavailable`, `error.stale-list` and
`error.list-edit-pending`. The section reuses existing note, context, status and link styles.

## Validation boundaries

Twenty-five new native pin tests plus discovery/freshness regressions pass. Forty-six focused frontend tests
cover menus, Undo, list order, ownership, positions and snapshots. Full `pnpm check:repo`, `pnpm test:quiet`,
`pnpm --dir web check` and `pnpm build` (real Worker plus distribution validation) pass. No browser, public-relay
publication or shipping result is claimed; those review boundaries remain in the handoff report.
