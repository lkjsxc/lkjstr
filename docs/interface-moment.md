# Interface specification: the moment of a note

## Purpose

The owner asked on 2026-11-21 (owner batch, item 6) that clicking a post's time open a tab with the timeline of the
people that author follows, around that moment: what they were seeing then, anchored at the post's time, with posts
before and after, loading in both directions, titled by the author and the time. Index and rules:
[interface-specs.md](interface-specs.md). The engine contract is [absolute-time-window.md](absolute-time-window.md).

## Decisions

- The tab is the existing `their-home` kind for the author with `at` (Unix ms) in its state: the same query, so the
  engine reuses Their Home. It never uses the reader's Home, even for their own note.
- The pressed time is the time printed in a note's header (`row.at`, the original note's time even on a repost row).
  One press, no menu; `A` on the keyboard-selected note does the same; the text still opens the thread.
- Title: `moment.title`, `{name} yyyy/mm/dd hh:mm` in local time (Japanese joins them with a middle dot). The tooltip
  holds the whole title; fixed tab width cuts it.
- All honesty is on one moment line where the time falls: the author's face, the time, the follow list's own date (or
  "not known yet") and "From this device only" while either side is cache-only. Each list end says its own state.
- The moment tab never mounts the time rail or the scrubber (their seeks would release the pivot). The scroll label
  (interface-time.md C1) works there, since it is a native time-ordered list.

## Spec: C4 The moment tab (cache-only, the existing Worker)

### Opening

- **Where.** The time in a note's header is a button when the engine serves protocol 15 or later, the row is not
  pending, and the row is a note (feeds, profiles, threads including compact ancestors, bookmarks, the moment tab
  itself). Quoted cards, grouped notifications, messages and drafts keep a plain time; a reply or mention drawn as a note in
  Notifications carries it too. Below protocol 15 nothing changes:
  a press on the time falls through to the note and opens the thread, as today.
- **Press.** `env.open('their-home', { pubkey: author, at: row.at, title }, how(e))`: the same tile, right after the
  current tab, in front. Shift-click splits and middle click opens behind, as for a person. `A` on the selected
  note is the same press. `.time` keeps `--faint`. On a fine pointer, hover gives `--fg` and an underline. A focus
  ring as for other buttons. The hit area grows by 6px vertical padding with an equal negative margin, so the
  header line stays one fixed height. The accessible name is `moment.press`. The tooltip stays `fullTime`.
- **Title.** `moment.title` with `{time}` = `dayOf(at) clockOf(at)`. It is recomputed from `at` on every mount and
  when the name arrives (extend `watchHomeTitle`). The state stores only ms, never the printed time. Before the name
  arrives it uses the short npub, never hex.

### The window

- On open with no saved place, the UI requests `window({ at }, 60, 60)` (the item 5 seek size). It never requests
  `top`, `{key}` or `{month}` for this tab. So there is no live head, no fresh pill and no ordinary history while
  the tab is open.
- **Growth.** When the reader comes within 1400px (`NEAR_PX`) of an end, that side grows by 60 through
  `window({ at }, newer, older)`. Once newer + older would pass 800, the far side shrinks by the same amount, but
  only while its last drawn row is more than two screens from the viewport. The keeper holds the reading row, so
  nothing moves. One side never passes 800.
- **Seat.** It runs once per tab, on the first `timeWindow` that carries a `key`. It does not run when a saved
  place was restored or the reader has already scrolled. The moment line's top goes to `round(clientHeight / 3)`.
  With too few newer rows to fill that third, the list stays at its top. Later `timeWindow` messages (the follow
  list arriving, cache changes, growth) update the moment line in place and never move the list.
- **Reload.** `state` keeps `at`, the two side counts and `pos`. Reopening requests `window({ at }, newer, older)`
  and then `keeper.put()`. If the saved row has gone, the seat runs.
- **No filter row and no rail** while `state.at` is set. The time rail candidate is false, and Home goes to the
  first drawn row with no `top` window. Day dividers and C1 stay.

### The moment line

- **What it is.** A row the UI draws, with key `moment:`. Like `day:`, it never anchors. It goes directly above the
  first drawn row whose reading time (`repostedBy?.at ?? at`, the rail's `rowTime`) is at or before `at`, or after
  the last row when every row is newer. Rows in the same second as `at` go below it. For day dividers it counts as
  an item at `at`, so a divider for the moment's own day goes above it.
- **Look.** It is in the day-divider family: a `--paper` band with hairlines above and below in `--sep`, which is
  stronger than a divider's `--line`. Padding 5px 12px, centred, tabular digits, and nothing new coloured. There
  are two groups:
  1. `face` 16px circle (press: profile) plus `dayOf(at) clockOf(at)` at 12.5px in `--accent`;
  2. evidence at 12px in `--faint`: the follow-list part, then `moment.deviceOnly` while either side is
     `cache-only`, joined by `list.dot`.
  At 420px of tile and wider, the groups share one line, joined by `list.dot`. Below 420px, group 2 wraps whole
  under group 1 with no dot, and the follow date there is date only. The line is `role="separator"`, and its
  accessible name is both groups' text.
- **Follow-list part, from `timeWindow.followList`.**
  - `latest-verified` gives `moment.follows` with `{time}` = the list's own `created_at`, printed like the
    moment. The tooltip is `fullTime`. The same words fit both cases: a list dated after the moment is today's
    list, and one dated before it was already in force then. The reader sees both dates side by side, and nothing
    claims to be the follows at that time.
  - `unknown` or absent gives `moment.followsUnknown`. The two list-end lines are not drawn then. The existing feed
    state line (`feed.loading` / `feed.empty`) speaks instead, because the reason is the missing list, not the
    device.

### The two ends (independent)

Each side has its own state, and each line sits at its own end of the list in `.fstate` style, one quiet centred
line. In C4 the Worker reports `cache-only` on both sides, and the UI derives the end of a side from the side alone:

| Side state (C4) | How it is known | Line at that end |
| --- | --- | --- |
| more | that side returned as many non-hidden rows as asked | none; growth continues |
| device end | fewer non-hidden rows than asked on that side | `moment.newerEnd` / `moment.olderEnd` |
| bound | that side holds 800 rows | `moment.bound` |
| unsupported | `newer`/`older` is `unsupported` | `home.unsupported` once, no edge lines |

A side's line depends only on that side. Growing one side never redraws the other side's line.

### C4 acceptance (mock fixtures plus the real Worker; shots below)

1. Press. In Home at 1440, pressing a note's time opens `their-home` right after Home, in front. Its state is
   `{pubkey, at: row.at}` and its title is `name yyyy/mm/dd hh:mm`. Shift-click splits, middle click opens behind,
   and `A` matches the press. Pressing the text still opens the thread. On protocol 14 the time is not a button.
2. Seat (Worker). The moment line is directly above the row whose key is `timeWindow.key` when that row's reading
   time is at or before `at`, and directly below it otherwise. Every row above is newer than `at`, and every row
   below is at or before it, same-second rows included. A followee repost sits by its repost time. On open its top
   is within 1px of `round(clientHeight / 3)`, or the list is at scrollTop 0.
3. Provenance (Worker). When `latest-verified` arrives after `unknown`, the evidence text changes in place. The
   reading row moves by less than 1px, and the seat does not run again.
4. Only `{at}`. A protocol trace over open, scroll to both ends and reload shows only `window({at}, n, m)` for this
   sub, with n and m at most 800 and n + m at most 800. The Worker issues no followee history filter and no live head
   filter for the pivot (it already proves the first of these; extend that check to the growth requests).
5. Independent ends. With 3 newer and 120 older cached notes, the top line shows at open and the bottom line shows
   only after the older side runs out. The mirrored fixture gives the mirrored result. A one-sided growth leaves the
   other line's node identical.
6. Local time. With `TZ=Asia/Tokyo`, a note at 2026-10-31T20:30:00Z gives the title and line `2026/11/01 05:30`. With
   `America/New_York`, the same stored state renders `2026/10/31 16:30` after reload.
7. Reload. After a scroll and a reload, the reader is at the same row and offset, with no re-seat.
8. Signed out. It works the same, because Their Home needs no account.
9. Phone. At 390, a tap on the time opens the tab. The hit area is at least 32px tall, and the header height is
   unchanged. The moment line wraps into two centred lines.

Checks: `web/scripts/smoke-moment.ts` (press, title, seat, provenance words, no filter row, reload, `A`, text still
opens the thread; 1440 and 390) and `web/tests/moment.test.ts` (line placement by reading time with ties below,
unknown follows). The mock answers `latest-verified` for every author, dated one fixed morning.

## Spec: C5 Both directions from relays (needs engine R1 to R6; UI only after them)

The UI change is small once the engine reports per-side states. The moment line drops `moment.deviceOnly` when
neither side is `cache-only`. Each end shows its own state:

| Side state (additive) | Line at that end |
| --- | --- |
| `loading`: a bounded relay span on that side is in flight | `feed.loading` |
| `partial`: a full page arrived, more may exist | none; prefetch 2-3 screens ahead |
| `stalled`: some routes on that side timed out, others answered | `moment.stalled` + `moment.retry` button |
| `end` (older): every route answered with less than a page down to the bound | `moment.olderNone` |
| `now` (newer): the newer span reached the present | `moment.newerNow` |

A stalled route on one side leaves the other side's state untouched. Retry re-asks only that side. Arrivals on
either side insert under the keeper, with no movement at the reading row.

## Remote directional needs (engine, Codex; distinct from C4)

- **R1 Older span.** One bounded relay REQ per route with `until` = the pivot second, inclusive, and the existing
  inclusive overlap and stable id dedup against cached rows. It pages deeper by the route's own inclusive `until`.
  It reports `older`. It is first in value, because this side is what the author was seeing.
- **R2 Newer span.** `since` = the next second, with a finite `until`, widening outward (for example 1h, 6h, 1d,
  then onward to now) because relays return newest first. A full page is `partial`: narrow toward the anchor
  before seating or claiming a nearest row. It reports `newer`, and `now` once `until` reaches the present.
- **R3 Paging that keeps the pivot.** Key-anchored or offset windows inside a pivoted view keep the time order, the
  spans and the per-side evidence. Then the DOM window can slide past 800 without falling back to head-first
  history.
- **R4 Per-side states in `timeWindow`.** `newer`/`older` take `cache-only | loading | partial | stalled | end | now |
  unsupported`, scoped to (sub, `at`, `followList.id`). A stale span's answer never updates a newer pivot.
- **R5 Release.** Spans are cancelled when the tab hides or closes (the existing want release), and re-planned when
  the follow-list id changes, keeping cached rows.
- **R6 Prefetch policy in Rust.** Per side, keep 2-3 screens ahead, matching the owner's prefetch item, so that
  `follow()` only reports distance.
- **Not now: follows at that time.** Relays mostly keep one kind-3 per author, and the store keeps one. Claiming
  "follows at that time" would need its own evidence contract. C4/C5 never claim it.
- **Proof.** Signed loopback fixtures for both directions, with a stalled route on one side, overlap, and same-second
  ties at the pivot (as the handoff says).

