# Time rail

## Purpose

Protocol 5 replaces native scrollbars in supported chronological note lists
with a cache-wide month rail. The reference is the owner's image01.png.
No relay counts are estimated and no public traffic is used in verification.

## Map and input

`web/src/views/time-scale.ts` is the pure shared map. An occupied month gets
min(4px, H/(2M)) plus its share of the remaining height, weighted by sqrt(n).
Within that interval, notes occupy equal ordinal slots, newest first. Empty
months have no interval. Future timestamps join the current UTC month;
epoch zero remains January 1970. Numbers win over dots, newer marks win over
older marks, and the oldest year number is reserved before other marks.

`time-rail.ts` uses this map for marks, pointer targets, the place line and
the return tick. The engine supplies positions for the current window.
Loaded targets scroll normally; other targets use the existing window input
with a month and note ordinal. The existing keeper restores anchors and
relative offsets. A jump leaves one return place; returning consumes it.
Home/End address the newest/oldest cached notes. The held label uses actual
finished row times and the existing scrub wording after the target arrives.
Loaded and unloaded jumps both retain the original row and offset. Home/End
belong to an open popover until it closes.

The sticky holder moves with its view when the WM reparents tiles. Width is
reserved before marks arrive: 56px at 520px tile width, otherwise 16px.
Narrow year labels appear over content on hover/hold; touch has a 28px hit
area. No animation is used. The rail is aria-hidden and the original list
remains the keyboard scroller. A nonoverflowing list hides the rail; one
occupied month shows only the place line. Unexhausted relay history fades
the lower marks. Scrolling to the local end keeps the existing history path.

## Engine and bounds

`wire/timeline.rs` walks the store's ordered time index, 256 events per
client Worker turn, round robin across visible subscriptions. Hidden clients
pause this work; close/detach releases the session index. Counts debounce for
100ms and scan a fixed insertion-generation cutoff, so live or backfilled
arrivals join the next scan without restarting partial work. Deletions,
metadata/filter changes and late repost targets invalidate partial scans. Matching
reuses the ordinary window predicate, including rich filters and mutes.
There are at most 128 queries per client and 32 clients. Each query retains
at most two store-sized key maps and one store-sized ordinal lookup. A prior
finished map remains seekable while its replacement is built. The actual
store remains bounded at 16000 regular plus 4000 replaceable events.
The shared store retains one generation per event, released on removal;
snapshots do not clone events or the store and keep the 256-event slice bound.

Candidate selection no longer truncates ordinary notes at 6000, allowing
seeks to reach every retained match. UI windows retain the existing 800-row
bound; a rail seek requests 60 rows on each side. Transport reconnect waits
for the rebuilt index before replaying an ordinal window. There is one
window renderer and history scheduler, not a second feed implementation.

## Deliberate native fallbacks

The real engine retains native scrolling for grouped notifications, feeds
with notifications mixed in, signed-out Global's contextual spam policy,
repost/reaction profile kinds, unhydrated disk history beyond the newest
2000-event startup cache, cache-queue loss or store retention eviction, and
matching resolved repost wrappers whose
collapsed target can break chronological order. Unresolved wrappers have no
displayed row and are ignored. Bookmarks preserve list-owner order, people
lists and threads are not chronological note feeds. Mock search results that
include people also retain native scrolling. These paths do not advertise
an approximate count or offer unsupported seeks. Normal Home, signed-in
Global, hashtag, chronological search, profile notes/media and channels can
use the rail. Neither native fallback nor metadata headers enter counts.

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
