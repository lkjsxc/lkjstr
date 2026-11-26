# Time rail

## Purpose

Protocol 5 replaces native scrollbars in supported chronological note lists
with a cache-wide month rail. The reference is the owner's image01.png.
No relay counts are estimated. Automated verification uses loopback relays.

## Map and input

`web/src/views/time-scale.ts` is the pure shared map. An occupied month gets
min(3px, H/(10M)) plus its share of the remaining height by note count, so the
map is by rank, like a native scrollbar, and all floors take at most a tenth.
A few old posts years below busy recent weeks (a sparse tail) stay short at
the bottom instead of halving the room of the weeks being read: 3000 and 800
notes over 36 one-to-three-note months on 800px got 413px under the former
sqrt weighting and get 711px now. Within a month, notes occupy equal ordinal
slots, newest first. Empty months have no interval. Future timestamps join the current UTC month;
epoch zero remains January 1970. Marks are planned in `time-marks.ts`: the
oldest year label first, then years, months and days newest first, then dots.

`time-rail.ts` uses this map for marks, pointer targets, the grip and
the return tick. The engine supplies positions for the current window.
Loaded targets scroll normally; other targets use the existing window input
with a month and note ordinal. The existing keeper restores anchors and
relative offsets. A jump leaves one return place; returning consumes it.
Home/End address the newest/oldest cached notes. The held label uses actual
finished row times and the existing scrub wording after the target arrives.
Loaded and unloaded jumps both retain the original row and offset. Home/End
belong to an open popover until it closes.
The last seek can finish after release and still leaves the original return
point. A return pressed during a seek waits for that window and clears the drag queue.

The sticky holder moves with its view when the WM reparents tiles. Width
is reserved before marks arrive: 56px at 520px tile width, otherwise 16px.
The first frame follows the engine's last answer for the same tab kind on
this device (`lkjstr:rails`), so a refused list starts at native width. A
refusal holds for the page's session; an acceptance without months is no
answer. Narrow year labels appear over content on hover or hold. Touch has a
28px hit area. The grip pill appears with the first dated row, even while the
list fits in the tile. Hover and hold highlight it, and it follows the held
pointer (interface-time.md C3). A jump leaves a thin return tick. The rail is
aria-hidden and the original list shows focus for keyboard input. With its room
reserved and nothing counted yet, the rail shows the grip at the share scrolled.
Marks appear as soon as counts arrive. A plain drag scrolls by share and shows the top row's time
until release, when any new count takes effect. A top row the engine has not
counted yet (`time-near.ts`) places the grip at its nearest counted row,
older first, with the share scrolled as a fallback. Unexhausted relay history fades the lower marks. Scrolling to
the local end keeps the existing history path.

## Local days

The same scan also builds `days` (`wire/timeline_days.rs`): one part per local day per UTC month,
newest first, from the page's own calendar (the Worker's `Date`; UTC natively). A changed zone or
local date rebuilds the index. Past 400 occupied days the answer names only the newest 400; older
months are marked from their UTC bands (years labelled, months as dots; `[` `]` step by month
there), so a sparse old tail never takes the recent days' names away. The interface uses
them only in its own zone: `time-marks.ts` plans labels and dots, `time-days.ts` finds a place's
day and the `[` `]` steps, `time-seek.ts` keeps one seek out at a time, `time-input.ts` reads the
pointer and keys. Narrow rails name only years.

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
notes arrived, a seek landed) is answered at once with the prior months, days
and positions, so a drag never waits a whole rebuild for its landing. The
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
`rail-guess.ts` keys persisted width guesses by tab kind and mode (`railKey`),
so a refused mode (such as signed-out Global) never narrows a supported one.

## Supported tabs and deliberate native fallbacks

Chronological lists using the time rail: `home` (note-only and Notifications:
Show, including the default phone Home), `their-home`, `global` (signed in),
`notifications`, `search` (chronological notes with bounded people header),
`hashtag`, `profile` (`posts`, `replies`, `reposts`, `reactions`, `media`,
`articles`, `lists`, `all`), `channel`, `relay`, `messages` (DM inbox) and `message`
(DM conversation). In a note-only Home, the original or resolved repost that
earns a row its place owns the ordinal and timestamp; unresolved wrappers are
ignored. Neither native fallback nor metadata headers enter counts.

Signed-out `global` retains native scrolling: its contextual spam policy
(`global.rs` `classify_window`) caps each author at three rows and folds
ten-minute duplicate bursts relative to each window's starting slice. A
cache-wide ordinal index would weight spam bursts and expose spam by resetting
window context at seek targets. Native scrolling also covers unhydrated disk
history beyond the newest 2000-event startup cache, cache-queue loss and store
retention eviction. Non-chronological views remain native: `bookmarks` (NIP-51
list-owner order), `thread` (reply tree), `following` and `followers` (people
lists), `channels` (channel directory), `media`, `compose`, `profile-edit`,
`account`, `settings`, `relays`, `stats` and `docs`. These paths do not
advertise an approximate count or offer unsupported seeks.

## Verification

Unit cases cover monotonicity, ordinal round trips, busy/quiet months, one
month, small floor allocation, epoch/future timestamps and mark collisions.
Native and mock tests cover cache-wide counts, tied ordinals, seeking beyond
the current window, invalidation, close and native fallbacks. The Worker
conformance and both browser smokes exercise protocol 5. Home smoke checks
drag to the oldest year and return to the exact original row. Optional
captures are rail-1440-dark, rail-1440-light and rail-390-dark in tmp/screens.

The browser WASM benchmark over 100000 synthetic stored notes measured
88.9ms total CPU across 395 slices, with a 0.9ms maximum slice. These are
count-index timings, not elapsed time between scheduled Worker turns. The
ordered lookup avoids a whole-map rehash during a slice. The report is
`tmp/engine-harness/wasm-benchmark.json`.

Frontend check/build and mock smoke pass (197 checks).
The four quiet gates pass; Worker conformance is 216/216 without page errors.
Six native timeline regressions include a 7000-note retained-store seek,
continued seeks during rebuild, and tracking a return ordinal after arrival.
Screenshot review includes dark/light desktop and single-tile phone Home.
Two consecutive `LKJSTR_SHOTS=1 pnpm --dir web smoke:real` runs pass 92/92
each, without page errors, including all signer scenarios, rail drag/return,
fade-container bounds and narrow-label hover. Reports are saved separately
as `tmp/real-smoke-1-report.json` and `tmp/real-smoke-2-report.json`.
Docker is excluded by the worktree-only write rule. No CI, deployment,
production access, commit or existing-service changes were made. Source
changes remain uncommitted, so the worktree is intentionally modified.

Review follow-up adds three native regressions for continuous live/backfilled
ingestion, deletion/mute invalidation and late repost resolution. Five UI cases
cover loaded click/drag and Home/End returns with the original offset, plus
popover keyboard ownership. All four quiet gates and frontend check/build/smoke
pass; the Home screenshot was reviewed. Worker conformance passes 216/216 and
the delayed profile probe passes. Real UI smoke passes 86/86 on an isolated
retry with no page errors; the first run timed out on a detached account-removal
button after its rail checks passed. Logs: tmp/review-real-smoke.log and
tmp/review-real-smoke-retry.log. Docker remains excluded by the worktree rule.
