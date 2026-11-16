# Ninth public-network performance measurement

## Purpose

Record the dated real-build measurements and their limits. Coverage and the
subsequent offline diagnosis belong in the [coverage record](engine-performance-ninth-coverage.md).

## Frozen scope

- Source: `d0a4c3d7563a206ebbc471bd339bb6ead032faa9`.
- Public account: `f9d4978f63e4da11b446971bd9ffc9a3b84db85d8581148a13ff7474e045d4eb`.
- Run: `tmp/r9d1`; 34 production files, 35 measurement sources and both native
  helper binaries were copied and hashed before launch.
- Main: 2026-11-16 21:47:34.099 to 23:01:41.140 UTC.
- Live interval: 21:47:53.562 to 22:47:53.670 UTC, **3,600.108 seconds**.
- Fresh browser profile using that read-only account; 451 distinct followed authors including self.
  Bootstrap relays were yabu.me, nos.lol and relay.damus.io; actual routes expanded.
- No saved owner account or external signer; relay guards admitted REQ/CLOSE only.
  Service workers were blocked. This run does not test an installed offline shell.
- This differs from the earlier 156-follow workload; it is not a matched
  before/after speed or memory comparison.
- Initial load average: 1.20 / 1.40 / 1.87; final: 3.26 / 6.48 / 5.96.
  Concurrent work on the shared host continued.

## Startup and scrolling

| Operation | Note | Name | Loaded avatar |
| --- | ---: | ---: | ---: |
| Cold signed-out Global, from navigation | 447 ms | 9,423 ms | 9,829 ms |
| Home, after Global: public npub submission | 1,112 ms | 1,112 ms | 1,112 ms |
| Warm Home reload | 454 ms | 1,196 ms | 1,196 ms |

The probe polls DOM state every 100 ms; avatar timing requires a loaded image.
These are observed readiness times, not compositor paint timestamps.
Home timing starts after the signed-out Global visit: metadata/cache already
acquired there may contribute to the 1,112 ms result. Warm Home is a reload in
the same owned profile after the fault phases, with existing account/cache state;
it completed in 1,196 ms. Neither is an independent cold-Home benchmark.

The 2,000-note scroll target completed with 2,009 distinct IDs from the original
scroll sampler in 69.087 seconds. Its 109 steps had median 613 ms, nearest-rank
p95 798 ms and maximum 969 ms. The 69 observed waits for new rows had median
722 ms, p95 1,846 ms and maximum 2,495 ms. These include the deliberate 600 ms
polling delay. The scroll sampler is distinct from the source-scoped, direct
top-level Home DOM witness used for coverage.

## Live resource observations

There were 61 samples. Byte figures below are separate browser estimates:
`Runtime.getHeapUsage.usedSize`, embedder heap and reported WASM linear memory.
They include bounded measurement overhead. Do not add overlapping estimates or
interpret them as process RSS.

| Measure, bytes | Start | Minimum | End | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Page JS heap | 4,162,152 | 4,162,152 | 24,588,132 | 82,672,768 |
| Page embedder heap | 3,418,936 | 3,418,936 | 157,770,696 | 454,866,632 |
| Worker JS heap | 1,986,140 | 1,986,140 | 12,133,920 | 29,074,712 |
| Worker embedder heap | 2,737,088 | 631,208 | 5,463,528 | 8,350,728 |
| Worker WASM linear memory | 5,898,240 | 5,898,240 | 66,846,720 | 66,846,720 |
| IndexedDB usage estimate | 1,511,175 | 1,511,175 | 9,884,935 | 9,884,935 |

The JS/embedder maxima and first WASM maximum occurred at live +69.206 seconds,
21:49:02.709 UTC, load 2.06 / 1.66 / 1.92. Heap values subsequently fell without
forced GC. IndexedDB uses the browser's `storage.estimate()` estimate; its
`usageDetails.indexedDB` equalled total usage at the first and last samples.
The physical event-store count rose from 507 to 5,842. This finite observation
does not establish indefinite growth or a leak.

Live open sockets ranged from 14 to 17, ending at 14; open engine subscriptions
ranged from 16 to 60, ending at 56. Load averages ranged from 1.04 to 15.47
(one minute), 1.44 to 8.35 (five minutes) and 1.69 to 4.76 (15 minutes).

Cumulative counters through the last live sample recorded 212,814 rAF callbacks,
512 gaps strictly above 34 ms, 267 above 100 ms and a maximum gap of 799.9 ms.
The first live sample already included 653 callbacks and three gaps above 34 ms
from startup. Between first/last samples the deltas are 212,161 callbacks, 509
gaps above 34 ms and 267 above 100 ms. A gap is counted when
the current callback sees the document as visible; this does not prove that its
entire interval was visible. These are scheduling gaps, not dropped compositor
frames, viewport paint measurements or exact rendered frame rates.

## Fault and cache phases

| Owned scenario | Actual interval or setup | Result |
| --- | --- | --- |
| Network cut, page and SharedWorker | 30.373 s from 22:48:21.207 UTC | Subscribed socket in 1,202 ms |
| Network cut, page and SharedWorker | 603.566 s from 22:48:53.375 UTC | Subscribed socket in 3,042 ms |
| Page lifecycle freeze command | 30.001 s | See execution caveat below |
| Second SharedWorker page, then close first | Home note/name/avatar 524 ms | Subscribed socket in 770 ms |
| Dedicated fallback, close leader | Fresh owned two-page case | New subscribed Worker in 1,021 ms |
| Synthetic cache boot | Exactly 20,000 signed event rows; seed 648.1 ms | First Profile note 328 ms |
| Actual engine Worker pause | Debugger pause 30 s plus page freeze and owned network cut | Subscribed socket in 2,535 ms |

Both network cuts reached zero open sockets/subscriptions. Their before/after
first visible IDs and offsets matched. Recovery timings establish subscribed
transport, not delivery completeness. The post-outage companion supplies the
separate, qualified delivery evidence.

The page-only freeze changed the first visible ID while retaining requested
Home anchor `top`, `atTop: true`, scrollTop 0, Fresh 0 and offset 41 px.
The newer note was created during the outage and arrived after reconnect.
The old first note later remained directly below it. This is consistent with an
ordinary top-of-feed update, not demonstrated place loss.

Exact freeze-start and `place()` timestamps were not retained. Snapshots bracket
the command at 22:59:00.130 and 22:59:30.285 UTC. They show 1,706 additional rAF
callbacks and a new top-level DOM observation at 22:59:05.658 UTC. Thus the
accepted lifecycle commands do not prove 30 seconds of suspended page execution.
The 74 ms socket observation after that command is not a sleep/wake result.

The separate Worker Debugger phase paused the actual engine target and cut only
owned networking; it ran 23:00:59.594 to 23:01:39.755 UTC. Its before/after loads
were 3.89 / 7.04 / 6.11 and 3.26 / 6.48 / 5.96. Neither scenario is OS/laptop sleep.
The SharedWorker case is persistence, not Web Locks leader replacement; the
dedicated case covers that separate lifetime. Cache boot configured no public
relay and published nothing.

## Completion and artifact identity

Main and companion exited 0; no page/CDP errors, forbidden publications,
remaining owned processes or cleanup errors were recorded. The launcher finished
23:01:42.384358 UTC with `workflowComplete: true`. Its stale `phase: running`
field was never updated by finalization; completion/exit/cleanup fields govern.

Original artifact SHA256 values:

- Production WASM: `9088e280584f9c35372b96b6fbd2a07b4ee6e14b3c276b4f45f5f44b0ebe6aef`.
- Production index: `dd397e61c844138b49278578fe74f575ac4c2b9e1f8a62f183ee2dd43f61669e`.
- `tmp/r9d1/freeze.json`: `0cb89fd8727c1fe0c7ec6318cb207f30adb8b54255f06913cf14a0013add2828`.
- `tmp/r9d1/tmp/run/report.json`: `a4e9dc1c274e726ede971c157760c884fb01d9505b439bb0282cc6b6c1c41415`.
- `tmp/r9d1/tmp/run/network-evidence.json`: `a4bc7f0b7a4894088a54dbd9f51a03c1a56b4a4184a244ec7bf921936a580d82`.

Derived read-only files are in `tmp/ninth-hour-review`:
`final-existing-evidence-summary.json` and `scoped-followup-evidence.json`.
Later account, quote-policy or scheduler work is not part of this frozen run.
