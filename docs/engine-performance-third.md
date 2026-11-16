# Third-landing public measurement

## Purpose

Record the real browser observations from the production artifact shipped on
2026-11-16. Keep measured behavior separate from incomplete delivery evidence.
All main and companion phases completed; their owned processes and data were cleaned up.

## Artifact and workload

- Clean source: `541e4a1ed626824d0f8218ae6dad41df7523e3ba`.
- Production WASM: `16f5e1eaac905008c0cb89d059ce092c073f7bac437e7bbc67588a57709bd336`.
- Full 34-file manifest: `tmp/third-shipped-dist.json`; frozen copy and native
  helpers: `tmp/real-hour-third-build-20261116T121333Z/manifest.json`.
- Run: `tmp/real-hour-third-20261116T121333Z/report.json`.
- The live interval lasted 3600.072 seconds, 12:13:43.253 to 13:13:43.325 UTC.
  The fault phases are additional time, not part of that hour.
- The fresh read-only public account followed 156 people; Home included its own
  key for 157 authors. Earlier 42-follow measurements are a different workload.
- Only REQ/CLOSE frames were permitted. No owner account, saved profile, signer,
  or public publication was used. Service workers were blocked for this public
  measurement; offline-shell installation has separate loopback coverage.
- First/last sampled load averages: 1.32/1.47/1.56 and 2.58/1.69/2.01. The
  one-minute load ranged from 0.75 to 6.59. The host was shared.

## Startup and scrolling

Cold signed-out Global first note/name/loaded avatar took 659/760/861 ms.
After submitting the public npub, Home took 135/135/2376 ms and reused the
Global cache. These are 100 ms DOM polling observations; loaded-image dimensions
were checked, not compositor paint timestamps. The final warm page reload took
241/444/241 ms for note/name/loaded avatar; this is a page reload in the same
browser session, not a separate browser restart.

Scrolling requested 2000 notes and observed 2082 distinct notes in 79.159 s.
The median polling step was 618 ms and the maximum 12.358 s. Median wait for a
new row batch was 614 ms; the maximum was 24.239 s. Each step deliberately waits
600 ms, so these are interaction observations rather than raw relay latency.

During the slow steps, Home requests continued answering EOSE in hundreds of
milliseconds, with a maximum observed Home EOSE latency of 2.065 s. The original
observer did not capture per-event receive/store/render timestamps. The evidence
therefore does not isolate DOM work, projection, GC, browser scheduling, or
backdated relay arrival. The measured scroll operation was delayed; attribution
remains unresolved.

The feed's 800-row moving request does not cap retained DOM at 800: the frontend
can retain up to 6000 cached rows above the anchor. The test observed 2000-plus
rows while scrolling, then returned Home to the top and its 800-row window.

A separate unprofiled synthetic case used the same frozen production files,
156 generated followed authors, 2500 signed rich notes, metadata hydration, and
reactions. At 12:39:46-12:40:52 UTC, load 1.28/1.75/1.90 to 2.28/1.97/1.96,
it rendered 2007 notes in 47.478 s. Its maximum step was 717 ms, maximum row/patch
handler 96.5 ms, maximum long task 97 ms, and maximum frame gap 116.7 ms.
It did not reproduce the 12-second delay. No rendering optimization was applied.
Artifacts: `tmp/scroll-profile-run-9YmKKH/{report,analysis,relay-trace,fixtures}.json`.
Its 66.010 s resource window overlaps the public hour and is explicitly recorded
in `concurrent-work.json`; it used no public relays or compiler.

## Hour memory and resources

All sizes below use decimal MB. Heap snapshots were sampled without forced GC;
these are separate CDP counters, not process RSS or a product-only memory total.
The bounded observation data contributes to the JavaScript heaps.

| Counter | First | Last | Maximum sampled |
| --- | ---: | ---: | ---: |
| Page JavaScript heap | 4.093 | 15.993 | 58.167 |
| Page embedder heap | 13.574 | 117.591 | 275.765 |
| Worker JavaScript heap | 1.686 | 11.922 | 11.966 |
| Worker embedder heap | 2.085 | 6.210 | 7.655 |
| Worker WASM linear memory | 5.439 | 79.954 | 79.954 |
| Browser IndexedDB estimate | 0.792 | 8.631 | 10.198 |

Physical cached events grew from 314 to 6693. After the initial history load,
WASM linear memory stayed at 79.954 MB. Open sockets stayed between five and six,
with 20 to 24 active subscriptions. Page heap fell after the scroll peak without
forced GC. Worker heap grew while both the public cache and observer history
accumulated; this hour cannot establish an indefinite memory-growth bound.

The page recorded 381 frame intervals over 34 ms,
281 intervals over 100 ms, and a maximum interval of 650 ms. These are rAF timing
samples, not a direct count of dropped display frames. No forbidden outbound
frame or page error was recorded during the live interval.

## Delivery evidence and limitations

The initial and final natively verified kind-3 IDs were identical:
`88275f6b5ef6eb16753368a99a592a0af9a6670b9a55216609a15d1dd2d52b33`.
Every retained post-adoption Home request used exactly the same 157 authors.
Three startup requests used self or the 156 follows while the account hydrated.
See `follow-membership-audit.json` for the exact sets and lifetimes.

The in-Worker query observer reached its character budget: 4,190,064 retained
filter characters and four dropped query records by hour end. It retained 2492
query records, below the independent record cap. Source/seen-ID evidence did not
hit its cap. Whole-hour completeness is therefore unknown; no zero-loss claim
can be made from these controls. The next observer must retain bounded route and
receipt evidence without repeating large author filters inside the Worker.

Independent controls on actual Home routes returned 50 natively eligible notes.
All five direct relay pages answered EOSE, with no returned error or notice;
their event counts overlap across relays:

| Home control relay | Returned events | EOSE elapsed ms |
| --- | ---: | ---: |
| yabu.me | 4 | 349 |
| nos.lol | 41 | 1390 |
| purplepag.es | 0 | 1353 |
| relay.ditto.pub | 50 | 700 |
| relay.noswhere.com | 0 | 1659 |

One was not in the hour-end Home seen set:
`df94441ac523a650256b2b6193e0b78c66da47db50995060b0a23231ef0150a5`.
It was created at 12:37:50 UTC; nos.lol and relay.ditto.pub first returned it to
controls at 13:13:45.400 and 13:13:47.446 UTC. The actual requests matched its
author/kind/time span. It appeared in Home by 13:14:58.929 UTC and was physically
cached at the 13:16:31 point lookup. Those observations do not establish when the
relays first had it or whether reconnect caused it to appear. It remains an
ambiguous delayed-visibility candidate, not a proven served-event loss.

The complete signed event, control provenance, original/successor filters,
Home intent/window snapshots and point lookup are in `home-gap-candidate.json`.
Matching EOSE alone does not prove that a relay sent a particular event.

Notification controls returned no eligible direct mention/reply note, so the
zero candidate count is not a completeness proof. Reaction/repost/zap
constituents are outside that control. The thread control used exact `[1,42]`
kinds and the singleton focus `#e`; one eligible reference was observed with no
missing candidate. Deeper replies without the focus tag remain outside scope.

### Startup instrumentation qualification

A later loopback fixture found that Playwright's separate CDP connection can
resume a SharedWorker before this harness finishes injecting its guard. A
minimal fixture constructed its socket in that gap, then failed in the patched
send path; this was not an application publication. The original hour did not
record a constructor-time guard marker. Its zero forbidden-frame count cannot
by itself certify the entire startup interval. The fresh profile had only a
public read-only account and no signer or publication action. Subsequent
measurements require an explicit startup barrier; this hour's unchanged asset
and observed traffic evidence do not retroactively acquire that guarantee.

## Fault phases and cleanup

The full run finished at 13:27:40.123 UTC. Its initial/final load averages were
1.35/1.48/1.57 and 1.88/1.82/1.91; phase-specific load was not recorded for every
short fault measurement. All recovery figures in this table concern a subscribed
socket, not proof that every eligible note was delivered.

| Scenario | Observed result |
| --- | --- |
| 30 s network cut | 30.258 s cut; subscribed socket after 2530 ms |
| 600 s network cut | 602.178 s cut; subscribed socket after 3026 ms |
| Page-only freeze | 30.002 s; existing subscribed Worker socket after 2 ms |
| SharedWorker, close first tab | Second tab note/name/avatar 246/246/550 ms; socket check 166 ms |
| Dedicated fallback, close leader | Different Worker target and subscribed socket after 519 ms |
| Exact 20000-event cache | 605.8 ms disk seed; first profile note 352 ms; physical count still 20000 |
| Page plus engine-Worker pause | 30.001 s freeze; Worker wall-clock gap 30073 ms; subscribed socket 2515 ms |

The 10-minute cut preserved the same visible Home note and its 41 px offset.
The 30-second cut had no usable before-place sample. Page-only freezing changed
the head note while the view was at the top; its pixel offset stayed at 41 px.
This does not prove position retention for a scrolled-away view.

The 20000-event cache used signed synthetic notes in a separate fresh profile,
with no relay socket or publication. Its first-note timing does not mean all
20000 notes were rendered. Its browser IndexedDB estimate was 13.487 MB.
The engine-pause case ran 13:27:00-13:27:39 UTC at load 2.14/1.87/1.93 to
1.88/1.82/1.91 and positively observed Debugger pause/resume on the actual
SharedWorker. Neither freeze case represents operating-system sleep.

The owned outage companion finished at 13:25:47 UTC, load 1.39/1.75/1.90.
It retained 20 natively verified payload receipts for six distinct eligible IDs,
all subsequently observed by Home. First receipt was 12.532 s after the saved
end-of-cut lower bound; the intentional page freeze overlapped that interval,
so this is not a clean UI recovery latency. Direct controls on nos.lol and
relay.noswhere.com returned five eligible Home notes, all seen, and no eligible
notification note. Follow membership was unchanged; 51 omitted query records
still make route completeness unknown. No matching thread source overlapped
the outage. The companion had zero traffic drops and no reported errors.

Main and companion exited zero. At 13:28:53 UTC, all four owned browser profiles
and runtime directories were absent, no owned Chromium process remained, and
all four owned HTTP ports were closed. Both guards and CDP reported no error.
The canonical tree and all 17 original harness hashes remained unchanged.
See `cleanup-confirmed.json`, `fault-summary.json`, and
`gap-audit-2026-11-16T12-14-01-457Z/{report,summary}.json` in the run directory.
