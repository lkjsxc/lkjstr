# Time rail

## Purpose

Protocol 5 replaces native scrollbars in supported chronological note lists
with a cache-wide month rail. The reference is the owner's image01.png.
Counts come from retained rows. Automated verification uses loopback relays.

## Map and input

`web/src/views/time-scale.ts` is the pure shared map. An occupied month gets
min(3px, H/(10M)) plus its share of the remaining height by note count, so the
map is by rank, like a native scrollbar, and all floors take at most a tenth.
An isolated old tail shares at most 9% of the rail or 72px, whichever is less.
It has up to three notes per month and a fifth of the total, with at least
two empty months and 60 readable notes above it. Each old ordinal stays
reachable. An 800px example with 400 recent notes and 80 isolated monthly
notes now leaves 728px for the recent notes, up from 602px. Within a month, notes occupy equal ordinal
slots, newest first. Empty months have no interval. Future timestamps join the current UTC month;
epoch zero remains January 1970. Occupied local spans in `time-ruler.ts` use the
same rank map. `time-marks.ts` starts at years and opens each labelled stretch to
months, days, hours, quarter hours and five minutes whenever another label fits.
Dense stretches get finer marks because they have more pixels. The year is the
major mark. Finer labels are smaller, and a tick can mark the next unit where
its label would collide. A held grip opens a short column one unit finer around
the pointer while the full reading-time label stays beside the grip.

`time-rail.ts` uses this map for marks, pointer targets, the grip and
the return tick. The engine supplies positions for the current window.
Loaded targets scroll normally; other targets use the existing window input
with a month and note ordinal. The existing keeper restores anchors and
relative offsets. A jump leaves one return place; returning consumes it.
Home/End address the newest/oldest indexed notes. The held label uses actual
finished row times and the existing scrub wording after the target arrives.
Loaded and unloaded jumps both retain the original row and offset. Home/End
belong to an open popover until it closes.
The last seek can finish after release and still leaves the original return
point. A return pressed during a seek waits for that window and clears the drag queue.
The latest waiting press shows its place with an ellipsis. A seek has two
seconds to answer. At expiry the rail releases it and handles the waiting press or return.

The sticky holder moves with its view when the WM reparents tiles. Width
is reserved before marks arrive: 56px at 520px tile width, otherwise 16px.
Chronological rail views reserve this width from the first frame, including
an empty view waiting for its first notes. The empty track stays visible and
gains marks and a grip as the rows arrive. Narrow year labels appear over content on hover or hold. Touch has a
28px hit area. The grip pill appears with the first dated row, even while the
list fits in the tile. The same vertical inset seats marks, the grip and pointer
targets, with 4px of room beyond the grip at both ends. Hover and hold highlight it,
and it follows the held pointer (interface-time.md C3). A jump leaves a thin return tick. The rail is
aria-hidden and the original list shows focus for keyboard input. With its room
reserved and nothing counted yet, the rail shows the grip at the share scrolled with
the top row's date and time. The loaded rows supply provisional ruler marks
that the counted map replaces when it arrives. A plain drag scrolls by share and shows the top row's time
until release, when any new count takes effect. A top row the engine has not
counted yet (`time-near.ts`) places the grip at its nearest counted row,
older first, with the share scrolled as a fallback. Unexhausted relay history fades the lower marks. Scrolling to
the local end keeps the existing history path.

Home, Their Home, Global, hashtag, Channel and Notifications use
the same admitted chronology for list rows and rail ordinals. A 24-hour
preview keeps recent cached and live notes available. Older rows join through
settled relay evidence. Home with three or more eligible follows requires three
distinct non-owner contributors in each admitted extension. A timed-out route
leaves its unanswered interval owed. Older events stay in the store, and
refill works from the visible end. See [fetch orchestration](fetch-orchestrator.md).
Search, profile lists and explicit Moment windows keep their own paging rules.

## Local calendar counts

The same scan also builds `days` (`wire/timeline_days.rs`): one part per local day per UTC month,
newest first, from the page's own calendar (the Worker's `Date`; UTC natively). A changed zone or
local date rebuilds the index. Past 400 occupied days the answer names only the newest 400; older
months are marked from their UTC bands (years labelled, months as dots; `[` `]` step by month
there), so a sparse old tail never takes the recent days' names away. The same scan counts occupied
five-minute parts in those days (`wire/timeline_clock.rs`). It retains at most one part per
counted row until the scan finishes. A reply carries at most 4096 parts, choosing complete
days by note count, newest first on ties. The UI combines these into local hours and quarter
hours. Both fields are used only in the page's zone. Day and month keyboard steps still use
the day and month counts. Narrow rails name years at rest and add finer marks during a hold.

## Engine and bounds

`wire/timeline.rs` walks the store's ordered time index, 256 events per
client Worker turn, round robin across visible subscriptions. Hidden clients
pause this work; close/detach releases the session index. Counts debounce for
100ms and scan a fixed insertion-generation cutoff, so live or backfilled
arrivals join the next scan without restarting partial work. Deletions,
metadata/filter changes and late repost targets invalidate partial scans. Matching
reuses the ordinary window predicate, including rich filters and mutes.
Grouped and activity lists (`notifications`, `home` with Notifications set to
Show including the default phone Home, and `profile` `reposts`/`reactions`)
index their projected `(key, time)` rows in `wire/timeline_projected.rs`,
counting at most 256 rows per client Worker turn and releasing the temporary
list when done or closed. Profile `articles`, `lists` and `all` index openable
events by authored time. Search indexes matching notes while keeping its
bounded directory people header uncounted.
There are at most 128 queries per client and 32 clients. Each query retains
at most two store-sized key maps and two store-sized ordinal lookups. A prior
finished map and lookup remain seekable while the replacement is built
(`wire/timeline_answer.rs`): a window that moves then (older history or live
notes arrived, a seek landed) is answered at once with the prior months, days, clock
parts and positions, so a drag never waits a whole rebuild for its landing. A deeper
history horizon joins the next scan. A newer horizon invalidates a prior map
whose older positions fall outside it. The
prior lookup is released when the build finishes. The actual
store remains bounded at 16000 regular plus 4000 replaceable events.
The shared store retains one generation per event, released on removal;
snapshots do not clone events or the store and keep the 256-event slice bound.

Private DM lists (`messages` inbox conversations ordered newest-first by latest
message time, and `message` conversation timelines ordered newest-first) reuse
`mountTimeRail` via `web/src/views/dm-rail.ts` over their already-projected
rows (bounded at 200 conversations and 8000 messages) without putting private
bodies into public caches. In `message`, jumps mount the target slice in
`dm-window.ts` on demand and preserve return ticks; unexhausted DM history
(`more`) fades the lower marks.

Candidate selection no longer truncates ordinary notes at 6000, allowing
seeks to reach every retained match. UI windows retain the existing 800-row
bound; a rail seek requests 60 rows on each side. Transport reconnect waits
for the rebuilt index before replaying an ordinal window. There is one
window renderer and history scheduler, not a second feed implementation.

## Supported tabs

| Tab | Where the time rail applies |
| --- | --- |
| `home` | Home with Notifications set to Hide |
| `home~news` | Home with Notifications set to Show, including the phone default |
| `their-home` | Another account's Home |
| `global` | Signed-in Global |
| `notifications` | The signed-in account's Notifications tab |
| `search` | Chronological note matches with a bounded people header |
| `hashtag` | Chronological notes for a tag |
| `profile~posts` | Profile Posts |
| `profile~replies` | Profile Replies |
| `profile~reposts` | Profile Reposts |
| `profile~reactions` | Profile Reactions |
| `profile~media` | Profile Media |
| `profile~articles` | Profile Articles |
| `profile~lists` | Profile Lists |
| `profile~all` | Profile All |
| `channel` | Channel timeline |
| `relay` | A relay's chronological feed |
| `messages` | DM inbox with reading access |
| `message` | DM conversation with reading access |

The lived-in browser smoke reads this table. Document where a new feature
applies in the same table and exercise its presence there.

In a note-only Home, the original or resolved repost that
earns a row its place owns the ordinal and timestamp; unresolved wrappers are
ignored. Neither native fallback nor metadata headers enter counts.

## Deliberate native fallbacks

Signed-out `global` retains native scrolling: its contextual spam policy
(`global.rs` `classify_window`) caps each author at three rows and folds
ten-minute duplicate bursts relative to each window's starting slice. A
cache-wide ordinal index would weight spam bursts and expose spam by resetting
window context at seek targets. A startup cache cut to the newest 2000 events,
cache-queue loss or eviction can withhold exact counts and ordinal seeks. An
eligible view always keeps its track, with a grip, marks and scroll-share
navigation as soon as rows arrive. It refines the map when exact data arrives.
Non-chronological views remain native: `bookmarks` (NIP-51
list-owner order), `thread` (reply tree), `following` and `followers` (people
lists), `channels` (channel directory), `media`, `compose`, `profile-edit`,
`account`, `settings`, `relays`, `stats` and `docs`. These paths do not
advertise an approximate count or offer unsupported seeks.

## Verification

Unit cases cover monotonicity, ordinal round trips, busy/quiet months, one
month, small floor allocation, epoch/future timestamps and mark collisions.
Native and mock tests cover cache-wide counts, tied ordinals, seeking beyond
the current window, invalidation, close and native fallbacks. Home smoke checks
drag to the oldest year and return to the exact original row. Optional
captures are rail-1440-dark, rail-1440-light and rail-390-dark in tmp/screens.
Both browser smoke commands exercise the supported tabs on a signed-in store
with over 2500 committed mixed-kind events, a sparse old tail and a removed
range. Every listed tab keeps a visible rail on reload and after a tab switch.

The browser WASM benchmark over 100000 synthetic stored notes measured
88.9ms total CPU across 395 slices, with a 0.9ms maximum slice. These are
count-index timings, not elapsed time between scheduled Worker turns. The
ordered lookup avoids a whole-map rehash during a slice. The report is
`tmp/engine-harness/wasm-benchmark.json`.

Targeted regressions cover a 7000-note retained-store seek, seeks during
rebuild, return ordinals after arrival, live and backfilled ingestion,
deletion and mute invalidation, late repost resolution, original offsets
after Home/End and popover keyboard ownership.
