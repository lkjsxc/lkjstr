# Interface specification: travelling by time

## Purpose

The owner asked on 2026-11-21 (owner batch, item 5): while a timeline scrolls, the date and time of the notes in
view stand beside the scrollbar thumb as `yyyy/mm/dd hh:mm` (24-hour); on wide panes an Immich-style scrubber
carries year, month and day marks that are pressed or dragged to jump, loading around the target time. This builds
on the time rail ([time-rail.md](time-rail.md)), which already maps every retained cached note, jumps, and leaves a
return tick. Index and rules: [interface-specs.md](interface-specs.md). The look is in [design.md](design.md).

## Reach

Note-only Home can show the rail with reposts. Each note takes the time of the original or repost that places it
in that view. Home with Notifications set to Show, including the phone default, uses native scrolling and C1.
Lists whose cache was evicted or cut short also use native scrolling. See the fallbacks in [time-rail.md](time-rail.md).

## Shared rules

- The rail measures the retained cache and nothing else. It draws no counts, and no text says "of N". The faded
  open end (`older`) stays the only sign that relays may hold more. A rail never seeks the network: the
  existing history path still runs when the reader scrolls past the oldest loaded row.
- Every time the rail or label prints is local time, as `dayOf` and `clockOf` compute it in the page: digits
  zero-padded, 24-hour, tabular, the same in both languages. The label never shortens with the list's span, never
  uses relative time (even with the relative setting on) and never shows a minute it does not know.
- The reading place is the first note or notification row whose bottom is below the tile's top (the existing
  `first()`). A repost reads as the repost's time (`rowTime`).
- No motion: things appear and disappear in one frame. Nothing new is coloured: `--accent` for the grip,
  `--faint` and `--fg` for marks, the existing `.scrub` box (raised, hairline, 6px corners, float shadow).
- The rail stays `aria-hidden`. The list stays the keyboard scroller; the keys in C3 are the keyboard's way to the
  same jumps.
- Mark planning, the label text and the day lookup are pure functions with unit tests, so they can move to Rust in
  a later port without changing this behaviour. This item does not wait for that port.

## C1 The scroll label

One label per list, the existing `.scrub` element. It reads `yyyy/mm/dd hh:mm` for the reading place.

- **When.** It appears on a scroll that the reader caused: a wheel, trackpad, touch or momentum scroll, a dragged
  native thumb, a scrolling key (arrows, J/K, Page, Space, Home/End), or a rail press. A scroll counts as the
  reader's when an input event came within the last 300ms or the label is already showing. It never appears for a
  scroll made by the list: restoring a tab, the keeper holding the anchor while notes arrive or media grows, a new
  note at the head, a tab opening or moving tiles.
- **Gone.** 1000ms after the last scroll, unless a rail press is held or a jump is still loading (C3).
- **Where.** Its vertical centre sits on the thumb's centre, clamped 4px inside the tile. In a rail list the thumb is
  the grip, and the label's right edge is 4px left of the rail (narrow and wide alike). In a list with a
  native scrollbar the label's right edge is 4px left of the scrollbar, and its centre is at
  `scrollTop / (scrollHeight - clientHeight) * (clientHeight - thumb) + thumb / 2`, where
  `thumb = max(24, clientHeight^2 / scrollHeight)`.
- **Which lists.** Every list in time order, on the rail or not: Home, Global, hashtags, chronological search,
  profile notes and media, channels, and the native fallbacks such as Notifications. Threads, people lists and
  bookmarks are not in time order and have no label.
- It sits above notes and rail marks and below menus. It takes no press (`pointer-events: none`).
- Its width only changes when its text changes, because the digits are tabular. On a phone, it follows the grip
  during touch and momentum scrolls.

## C2 The wide scrubber

A tile of 520px or more keeps today's 56px rail. Its marks now come in three levels. Labels are 11px, right-aligned
18px from the rail's right edge, in `--faint`; the current year stays `--fg`. Dots sit 5px from the right edge.

| Boundary | Label | Dot |
| --- | --- | --- |
| Local year | `yyyy` | 3px |
| Local month | `mm`, or `mm/dd` (the day it stands at) when any day label is placed | 3px |
| Local day | `dd` | 2px |

- **Placement.** Use the existing greedy rule, extended. Place the oldest year label first, then the years newest
  first, then months newest first, then days newest first. A label keeps 14px between centres from every label
  already placed. Then dots go on in the same order, each keeping 2px from every placed dot (labels have their own
  column). Labels and dots stay inside the rail as they do today. A boundary sits at its newest note: with newest
  first, a label marks where its period begins as the reader scrolls down, and hangs below that line.
- **A year's newest month** is named one line (14px) under the year, so the top of a year reads `2026`, then
  `11/22`, then the days. (Built 2026-11-22: drawn at the same line, the year label hid that month from the reader.)
- **Which boundaries.** With `days` (engine addition below), boundaries are local: a year or a month begins at its
  newest occupied local day, which need not be the 1st. `mm/dd` keeps a month apart from a day in the one column.
  Without `days`, the marks are today's UTC month marks, and only years are named.
- **Hover (fine pointer, any rail width).** A 1px `--sep` line crosses the rail at the pointer, and the label
  stands at the pointer: the full time if the note a press there would reach is loaded, otherwise `yyyy/mm/dd` from
  `days`, otherwise nothing. Leaving the rail removes both. The line stays with a held mouse.
- **Narrow rail (under 520px).** Unchanged: years over the content on hover or hold, dots at month starts (local
  when `days` is known), a 28px touch area, the C1 label.

## C3 Jumps and loading

Mouse, pen and touch share one path: pointer events on the rail, with capture.

- **Press.** It jumps to the note under the pointer. A press within 6px of a placed label's centre snaps to that
  boundary's newest note (so does a drag, and the hover label says the same target). A loaded target scrolls at once.
  Any other target uses the existing window seek with the same 60 rows on each side, which loads around the target.
  Either way one return tick is left at the place the press started, and a press on the tick returns to the exact row
  and offset.
- **Grip.** A visible rail always shows a 6x32px `--accent` pill centred in its rightmost 16px and clamped 16px
  inside the tile. The whole rail accepts a press. Hover and hold highlight the grip. During a drag it follows
  the pointer with the time label beside it.
- **Drag.** The label follows the pointer. Seeks run at most once per 80ms and one at a time: while one is out, only
  the latest target waits, and it is sent once the answer is drawn. So a target that arrives late never pulls the list
  back to an earlier one. While a press is held the bands and marks stay frozen, so a Timeline answer that arrives
  mid-drag is applied only on release.
- **Label while held or loading.** If the target note is loaded, the label shows the full time. Otherwise it shows
  `yyyy/mm/dd` from `days`, never blank and never an invented minute. If the target is still not shown 500ms after
  the last seek, a thin space and an ellipsis (U+2009 U+2026) are appended. When the window arrives the label shows the real
  full time of the row now at the top, then goes 1000ms later. If the answer lacks the target (evicted in the
  meantime), the keeper lands on the nearest row and the label tells that row's time. If the engine refuses the
  rail mid-drag, the hold ends and the list stays where it is (as today). Without `days` and with the target not
  loaded, the label waits for the row, as today.
- **Touch.** The whole 56px rail is the target on wide tiles. On narrow ones the 16px rail plus 12px to its left is
  the target (today's 28px). A touch grabs at once, because the rail sets `touch-action: none`. While a coarse
  pointer holds the rail, the label's right edge moves 24px left of the rail, so the thumb does not cover it. A tap
  is a press. An accidental jump is undone with the return tick, as every wrong press can be.
- **Keyboard** (the tile has the keys, no field is being typed in, no popover is open, no Alt or Meta). These are new
  `feed` bindings in `KEYS`:
  - Home and End go to the newest and oldest cached notes. This is unchanged.
  - `[` goes to the newest note of the next newer occupied local day; `]` goes to the newest note of the next older
    one. Without `days` both move by one occupied month. At the ends they do nothing.
  - Backspace returns to the tick, when there is one.
  - Every jump leaves the return tick and shows the C1 label. One visually hidden `aria-live="polite"` node per list
    then says the label's text once the jump lands.

The bindings are `timeNewer`, `timeOlder` and `timeBack`. Their Shortcuts words are already in both string tables:
`key.timeNewer` "One day newer (a month in long lists)", `key.timeOlder` "One day older (a month in long lists)",
and `key.timeBack` "Back to where the last jump started". The label itself has no words.

## Engine addition (additive, one line in engine-proposals.md)

`Timeline.days?: { at, month, offset, count }[]` and `Timeline.zone?: string`, built by the same ordered count
scan as `months`, with the same matching, debounce, invalidation and bounds per query. Months, positions and the
seek input are unchanged: the UI never sends a day, only the existing `{ month, offset }`.

- One entry per local day per UTC month part, newest first. `at` is the local day's start in ms. `month` is the
  existing UTC month start. `offset` is the ordinal, in the existing month order, of that part's newest note. `count`
  is the number of notes in that part. A local day that crosses a UTC month boundary gives two entries with the same
  `at`, the newer part first. So a day's mark is at `noteToPlace(bands, { month, offset })` of its first entry, and
  any target `{ month, o }` lies in the entry with `offset <= o < offset + count`.
- Local means the Worker's own `Date`, which has the page's zone. A 23-hour or 25-hour DST day is one day. A day
  whose midnight is skipped starts at its first existing instant. `zone` is the Worker's
  `Intl.DateTimeFormat().resolvedOptions().timeZone`, read at most once a second. When it changes, or the local
  day of now does, the counts are rebuilt; that answer does not have to come quickly. The core has no zone data: the
  Worker supplies a `Calendar` (UTC in native code and tests).
- The UI compares `zone` with its own zone on load and when the page becomes visible. If they differ, it ignores
  `days` (C2 and C3 fall back as if absent) until an answer arrives with a matching zone. A wrong day is never drawn.
- Future timestamps join today's local day, matching the month rule. Epoch zero is the local day it falls on (a day
  start before the epoch is sent as 0).
- Bound: `days` is left out when the query has more than 400 occupied local days. At that span day marks cannot be
  drawn, and the C2 and C3 fallbacks apply. At most 400 + months entries per query.
- The mock engine answers `days` and `zone` for its fixtures, including one local day that crosses a UTC month.

## Acceptance

Each check runs on mock fixtures, plus the real-engine smoke where it already covers the rail. Shots scenes:
`time-label-1440-dark`, `time-days-1440-dark`, `time-held-1440-light`, `time-label-390-light` and
`time-native-1024-dark`. The contact sheet follows [interface-specs.md](interface-specs.md).

1. Format. In both languages, the label of a loaded row matches `^\d{4}/\d{2}/\d{2} \d{2}:\d{2}$`. With
   `TZ=Asia/Tokyo`, a note at 2026-10-31T20:30Z reads `2026/11/01 05:30`, and a note at 13:05 reads `13:05`. Relative
   time on does not change it.
2. Trigger. Wheel, touch, key and thumb scrolls show the label, and it goes 1000ms after the last one. Restoring a
   tab, new notes at the head, media growing under the keeper, and opening or moving a tab never show it.
3. Position. The label's centre is within 1px of the grip's centre, or of the native thumb's. It stays
   inside the tile, and its box keeps the same width while only digits change.
4. Marks. At 1440, ten days across a month start read `2026`, `11/05`, `04` ... `01`, `10/31`, `30` ... No two labels
   are under 14px apart, and the oldest year is present. At 390 there are no day labels. With 401 occupied days there
   are no `days`, and the marks are today's.
5. Local boundaries. In JST, notes on both sides of local New Year put the `2027` label at the newest local 2027
   note. A note at 2026-12-31T16:00Z sits below that label, inside the UTC December band.
6. DST. In `America/New_York`, a fixture across 2026-11-01 has one day mark per local day and labels in local
   time. A zone mismatch drops day marks without drawing a wrong one.
7. Press and return. A press on a day label puts that day's newest note at the top. The tick returns to the exact
   original row and offset, and Backspace does the same.
8. Drag. Across unloaded months the label is never blank and never shows an unknown minute. At most one seek is sent
   per 80ms, and the list ends on the last target. A Timeline answer during the drag moves no mark until release.
9. Loading. A held-back seek appends the ellipsis after 500ms. On arrival it shows the real time, then goes. An evicted
   target lands on the nearest row and tells its time.
10. Keyboard. `]` from 11/20 lands on the newest note of the next older occupied day, and `[` comes back. The keys do
    nothing while typing, with a popover open, or at the ends. The live node speaks once per jump.
11. Touch at 390 light. A drag on the rail moves the list, with the label at least 24px left of the rail. A tap
    leaves the tick, and a swipe on the notes shows the label.
12. Bounds. Paint stays one frame callback. Mark planning for 400 days plus 120 months stays under 1ms (0.18ms in
    Chrome's engine on 2026-11-22), and runs only when the map changes, not on every scroll. The label reads no layout beyond
    the existing top-row search.

Built 2026-11-22: unit tests `time-marks`, `time-days`, `time-seek` and `time-rail`, native
`engine_timeline_days_test`, and the shared rail smoke (labels, `]` and Backspace).
