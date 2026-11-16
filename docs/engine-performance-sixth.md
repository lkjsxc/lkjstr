# Sixth public hour

## Purpose

Record the completed read-only measurement of the sixth landing, including
failed goals, evidence limits and subsequent fault phases. It is one shared-host
run, not a device budget or a claim of complete public-relay coverage.

## Artifact and workload

The immutable candidate is `37b14ab515d0900cec6c18940b2894973fd5a10b`.
Production WASM SHA-256 is
`1c0b50bef2a56c5def00dba885358481fdad1037d9b9f2127ff233d5131a6f97`;
index SHA-256 is
`5709cc51edcc4a145547841b47f016ab5258640271282afd638b73402756652c`.
The canonical final build matched the previously gated WASM exactly. The ship
attempt during this run stopped at archive validation before deployment, so
these measurements concern the candidate, not a newly served site.

`tmp/r61b/freeze.json` records copies of all 34 assets, 26 measurement/import
sources, both native helper executables and Playwright, plus Node/Chromium
fingerprints. The process loaded those frozen copies; later builds did not
replace its bytes. Paths here are relative to the canonical worktree.

The recorded main command, from the frozen directory, was:

```sh
node scripts/real-hour.mjs --seconds=3600 --scroll-notes=2000 \
  --helpers=existing --build=dist --output=tmp/run \
  --account=f5c4946da5d716c11245f46f48c94765b4cb60fba096eb606ebeeeae45d37bfc
```

The owned companion was `node scripts/real-hour-gap-audit.mjs tmp/run`.
The account had 156 follows; Home included self for 157 authors. The first
1.149 seconds of the live interval had a smaller bootstrap cohort; all later
observed Home filters used the final set. None of the seven missing candidates
was affected by that initial membership difference.

A fresh profile imported only the public npub. The host-release module
bootstrap confirmed the guard and host Network listener before original
SharedWorker import. Only REQ/CLOSE frames were permitted; no forbidden frame,
page error or main CDP error was recorded. Service workers were blocked because
their initial execution cannot be guarded here. This excludes offline-shell
behavior and adds bootstrap overhead to startup measurements.

## Date, duration and load

The live interval was 2026-11-16 16:25:30.595-17:25:30.767 UTC, **3600.172 s**,
with 60 retained samples. All faults and warm reload finished at 17:39:34.372;
the launcher finished at 17:39:35.232. Live load averages were 4.77/3.78/2.62
at the first sample and 7.54/6.43/3.81 at the last. Sampled one-minute load
ranged 0.63-18.34. Ship checks and other shared-host work overlapped the run.
The complete launcher range was 4.84/3.77/2.61 to 3.81/3.79/3.76.

## Startup and archive

| Measurement | Observed result |
| --- | --- |
| Fresh signed-out Global note / name / loaded avatar | 345 / 548 / 3211 ms |
| Home after public npub submission, reusing Global cache | 234 / 234 / 335 ms |
| Warm Home note / name / loaded avatar | 1864 / 1864 / 1864 ms |
| Requested / distinct top-level Home DOM notes while scrolling | 2000 / 1903; incomplete |
| Scroll duration / unchanged tail | 162916 / 60320 ms |
| Scroll polling step median / p95 / maximum | 617 / 1732 / 13963 ms |
| Newly observed rows: wait median / p95 / maximum | 669 / 2735 / 24721 ms |
| rAF intervals / over 34 ms / over 100 ms | 207859 / 751 / 456 |
| Maximum rAF interval | 750 ms |

Startup uses 100 ms polling and loaded image dimensions, not compositor paint.
Scroll steps include the deliberate 600 ms wait; they are not raw relay page
latencies. The longest automation step is not a single 13.963-second frame.
At the plateau, the list contained 1903 distinct data-note IDs, no duplicate
IDs, and another 84 note elements without IDs. Repost deduplication alone does
not account for the shortfall. The end state appeared in 75 unchanged polls.

The active Home element was `view feed`, without `has-time-rail`. This exercised
the unchanged sequential native-scrollbar fitting path. Collapsed reposts and
other Core eligibility limits can disable the rail; the exact Timeline reason
was not captured. It is not an after measurement of the separate batched
rail improvement in [frontend-layout.md](frontend-layout.md).

The final historical ditto request returned 200 distinct wire IDs; the next
inclusive cursor was sent to an empty purple route. This corroborates the
separately reproduced route-continuation failure, but does not prove all 200
were engine-admitted or how many older public notes existed. Exact receipts,
cache qualifications and the seven live coverage candidates are in
[the coverage record](engine-performance-sixth-coverage.md).

## Memory, storage and transport

| Sampled quantity | First | Last | Maximum |
| --- | --- | --- | --- |
| Page JS heap, bytes | 5268128 | 17490024 | 39047404 |
| Page embedder heap, bytes | 19211400 | 87895576 | 225736968 |
| Worker JS heap, bytes | 2532200 | 11360076 | 12269672 |
| Worker embedder heap, bytes | 2700408 | 6618632 | 8553864 |
| WASM linear memory, bytes | 4980736 | 77070336 | 77070336 |
| Physical IndexedDB event rows | 615 | 7225 | 7225 |
| Browser storage estimate, bytes | 1591350 | 8891050 | 11535539 |
| Active relay sockets | 5 | 5 | 5 |
| Active tracked subscriptions | 1 | 20 | 20 |

These unforced-GC snapshots include the bounded page/Worker probes and exclude
host-collector memory and process RSS. The page heap fell naturally during the
hour; WASM capacity stayed flat after history growth. They establish neither
product-only allocation nor an indefinite bound. There were 67 lifetime socket
creations and 62 closes, so five active sockets did not mean no reconnects.

At the last live sample, the host retained 3426 requests and 73582 distinct
query/ID/digest deliveries, with no evidence drop or forbidden frame. Its
capture-time certification was true. The Worker interned 4124344 filter
characters without dropping a live-hour query. Wire-projected Home IDs (2029)
and observed top-level DOM IDs (1945) are deliberately separate.

Later page close/reload makes final whole-run certification unknown. Target
counter objects in earlier summaries can reflect subsequent sampling; use the
dated sample counts and capture-time status, not their later-mutated target
array, to describe the hour. No such qualification permits a missing note to
be called rendered.

## Fault phases

| Scenario | Duration and result |
| --- | --- |
| Network cut requested 30 s | 30.436 s; subscribed socket returned after 1709 ms |
| Network cut requested 600 s | 603.158 s; subscribed socket returned after 4075 ms |
| Page-only freeze | 30.003 s; 5 ms connectivity check, SharedWorker remained active |
| Close first of two SharedWorker tabs | Connectivity observed after 153 ms |
| Dedicated-Worker fallback leader close | New Worker observed after 509 ms |
| Fresh page plus actual engine Worker pause and network cut | 30.001 s; new subscription after 2521 ms |
| Exact 20000-event physical cache boot | Seed 668.4 ms; first profile note after 230 ms |

The actual engine suspension recorded a 30152 ms Worker clock gap and explicit
Debugger pause/resume on that engine target. Neither freeze is host/OS sleep.
SharedWorker tab persistence is separate from dedicated fallback leader
replacement. Socket/REQ timing alone does not establish delivered-note recovery.
The 20000 signed synthetic cache events had no configured public relay; their
fixture key remained inside the native helper and nothing was published.

The outage companion ran bounded controls on noswhere, purple and nos.lol.
Two eligible Home notes reached top-level DOM by capture; their retained socket
receipts preceded wire projection by about 104-105 ms and DOM observation by
109-110 ms. This is a note-delivery witness, not catch-up completeness. Three
Worker query records were dropped after the budget was reached, and one page
snapshot timed out during the later page transition. Notification controls had
no eligible events, and no thread source overlapped the outage. All three
coverage claims therefore remain qualified or unknown.

## Artifacts and cleanup

Main evidence is `tmp/r61b/tmp/run/report.json`, `network-evidence.json` and
`summary.json`. The companion directory is
`tmp/r61b/tmp/run/gap-audit-2026-11-16T16-25-25-628Z`.
Exact candidate bodies/control provenance and offline analyses are under
`tmp/r61b/tmp/run/coverage-candidates`; the separate history receipt audit is
`tmp/r61b/tmp/run/history-receipt-audit.json`.

Both processes exited zero. The launcher's owned-process inventory was empty;
the owned HTTP/debug ports were closed, and all browser profile/cache/config/
data directories were removed. Final cleanup was checked at 17:44:56 UTC in
`tmp/r61b/tmp/run/cleanup.json`. The frozen public evidence remains available.
The main `complete` flag means the planned phases finished; it does not mean
the 2000-note goal or any completeness claim passed.
