# Open-race desktop baseline

## Purpose

## Outcome and scope

The cold desktop candidate reached all three opening marks ahead of nostter.
The five-minute reopening did not: its first text and first quiet interval
were later, its complete first screen took 723.8 ms, and relay replies preceded
every first screen. Warm layout movement and repeated relay downloads remain.

Twenty desktop observations support five-run medians for each client/case.
Two additional phone observations are retained, but nostter's worker setup
failed, so the paired phone comparison is invalid and report.complete remains
false. Day-use has not run. No all-situations or live-site victory is claimed.
The earlier [normal-route diagnostic](engine-performance-open.md) is unchanged.

- Date: 2026-11-17 01:03:53.046-01:24:34.786 UTC.
- Initial/final load: 4.63/4.33/4.73 to 12.47/8.29/6.36.
- Desktop observations ended at 01:23:02.411 UTC, load 12.15/7.37/5.91.
- Headless Chromium 153.0.8010.12, Playwright 1.65.0, Node `v24.18.1`.
- Exactly one browser, shared host/network, alternating desktop pair order.
- Same public SnowCait account, 309 signature-verified follows:
  npub1s02jksmr6tgmcksf3hnmue7pyzlm0sxwarh7lk8tdeprw2hjg6ysp7fxtw.
- Cold profiles contained only the public identity, with no signer or key.
  Preflight events did not enter browser storage. Setup closed before timing.
- Five-minute browser-close-to-navigation idle was 300.195-300.336 seconds.
  Actual profile age was about 0.096 hours; no clock aging was used.

## Desktop medians

All times are milliseconds from document navigation. The first screen is a
filled viewport whose intersecting notes all have names and decoded pictures.
First ten means the first ten DOM notes, not ten notes simultaneously fitting
the viewport. No unresolved row was skipped. Strict and settled-author marks
were identical in every desktop sample.

| Situation | Client | Valid/runs | First note | First screen |
| --- | --- | --- | --- | --- |
| Cold | nostter | 5/5 | 4960.6 | 5409.0 |
| Cold | lkjstr | 5/5 | 817.4 | 1158.6 |
| Five-minute | nostter | 5/5 | 527.1 | 1349.5 |
| Five-minute | lkjstr | 5/5 | 565.8 | 723.8 |

| Situation | Client | First ten | First rest | Final rest |
| --- | --- | --- | --- | --- |
| Cold | nostter | 6387.7 | 8220.9 | 15655.0 |
| Cold | lkjstr | 1208.1 | 3675.6 | 5298.4 |
| Five-minute | nostter | 1349.5 | 3227.0 | 41034.3 |
| Five-minute | lkjstr | 836.4 | 3399.0 | unavailable |

The cold first-note median is 83.5% sooner in this local-shell comparison,
meeting the proposed 20% target under this disclosed serving arrangement.
Warm lkjstr text is 38.7 ms later and first rest 172.0 ms later. Its 300 ms
pre-relay first-screen target is unmet. First rest records the first two quiet
seconds; it never promises that later notes or images will stay still.

| Situation | Client | CLS | Total shift | HTTP bytes |
| --- | --- | --- | --- | --- |
| Cold | nostter | 0.05853 | 0.11489 | 5087767 |
| Cold | lkjstr | 0.05176 | 0.06878 | 7272913 |
| Five-minute | nostter | 0.05342 | 0.18692 | 372711 |
| Five-minute | lkjstr | 0.76146 | 0.83030 | 155496 |

| Situation | Client | WS payload bytes | HTTP+WS bytes | Relay EVENTs |
| --- | --- | --- | --- | --- |
| Cold | nostter | 2160363 | 7247905 | 733 |
| Cold | lkjstr | 701496 | 8000042 | 574 |
| Five-minute | nostter | 1462848 | 1835559 | 627 |
| Five-minute | lkjstr | 790972 | 1000991 | 744 |

Columns are independent medians; the median of a sum need not equal the sum
of medians. HTTP uses CDP encoded transfer bytes. WS counts UTF-8 message
payload, excluding framing, TLS and compression overhead. The observation
ends 45 seconds after navigation commit; preceding navigation transport is
also included. Main-thread long-task median was zero in all desktop groups;
lkjstr warm run 3 nevertheless had one 67 ms task. Worker tasks are not counted.

Every warm lkjstr run shifted after its first quiet interval: 2/4/2/4/7
eligible layout shifts. Runs 4 and 5 never ended with two quiet seconds, so
their missing final-rest values invalidate that median. Warm nostter also
shifted later, 2/7/4/4/9 times. Neither client met the no-later-movement target.

## Cache and startup evidence

| Situation | Client | FCP ms | First relay reply ms | First EVENT ms | Engine ready ms |
| --- | --- | --- | --- | --- | --- |
| Cold | nostter | 164 | 429.8 | 429.9 | not observed |
| Cold | lkjstr | 48 | 211.0 | 216.2 | 121.7 |
| Five-minute | nostter | 108 | 396.6 | 402.7 | not observed |
| Five-minute | lkjstr | 48 | 221.5 | 227.8 | 90.4 |

Engine readiness is the ordinary ready message when observable, not an added
product hook. No desktop first screen preceded its first relay reply. All five
warm lkjstr pages had an SW controller and nine SW-served responses; disk-cache
response counts were 36-40. Their IndexedDB event counts were 573-586.
Nostter retained its ordinary event/metadata stores and 76-79 disk responses;
it had no SW controller or registration in these owned public profiles.

For each matching cold/warm lkjstr profile, warm/cold EVENT-count ratios were
1.07-1.45, median 1.31. HTTP+WS payload-byte ratios were 0.109-0.131, median
0.128; HTTP-only ratio median was 0.0214. Cached shell/images reduce transfer,
but relay replay does not approach the one-tenth event budget. These opening
observations are not the separate ordinary-use/repeat-view cache workload.
Per-row raw-key spells over 100 ms were 0/0/0/1/0 on warm lkjstr; the observer
cannot identify them as previously known authors, so it does not certify that
specific cache target.

## Individual desktop observations

| Case | Client/run | Note / screen / ten, ms | First / final rest, ms | CLS / total shift | Late shifts |
| --- | --- | --- | --- | --- | --- |
| Cold | nostter 1 | 4960.6 / 5377.3 / 5377.3 | 7227.2 / 7210.6 | 0.03409 / 0.03409 | 0 |
| Cold | lkjstr 1 | 625.7 / 1025.7 / 1025.7 | 3675.6 / 35310.6 | 0.01246 / 0.01275 | 1 |
| Cold | lkjstr 2 | 774.8 / 1024.8 / 1208.1 | 3524.7 / 3508.1 | 0.01370 / 0.01370 | 0 |
| Cold | nostter 2 | 4901.3 / 5384.6 / 6517.9 | 7201.2 / 44235.3 | 0.03074 / 0.09937 | 3 |
| Cold | nostter 3 | 5136.8 / 5553.5 / 5553.5 | 8386.7 / 15655.0 | 0.05853 / 0.12249 | 3 |
| Cold | lkjstr 3 | 817.4 / 1667.3 / 1667.3 | 3533.9 / 22952.0 | 0.05176 / 0.06878 | 2 |
| Cold | lkjstr 4 | 865.3 / 1598.6 / 1598.6 | 4398.4 / 4384.7 | 0.06879 / 0.06879 | 0 |
| Warm | nostter 1 | 482.9 / 1349.5 / 1349.5 | 3199.3 / 41034.3 | 0.03291 / 0.09466 | 2 |
| Warm | lkjstr 1 | 540.5 / 723.8 / 873.8 | 3290.4 / 37292.1 | 0.52925 / 0.63322 | 2 |
| Warm | lkjstr 2 | 565.8 / 715.7 / 965.7 | 3399.0 / 39617.3 | 0.62918 / 0.72212 | 4 |
| Warm | nostter 2 | 527.1 / 1360.4 / 1360.4 | 3227.0 / 40029.8 | 0.05342 / 0.22169 | 7 |
| Warm | nostter 3 | 775.4 / 1842.0 / 1842.0 | 2825.3 / 35590.7 | 0.12837 / 0.18692 | 4 |
| Warm | lkjstr 3 | 636.4 / 836.4 / 836.4 | 3569.6 / 17838.4 | 0.76146 / 0.83030 | 2 |
| Warm | lkjstr 4 | 601.0 / 751.0 / 751.0 | 3534.2 / unavailable | 0.76190 / 1.02769 | 4 |
| Cold | nostter 4 | 5037.7 / 6387.7 / 6387.7 | 8220.9 / 25541.5 | 0.13852 / 0.18986 | 2 |
| Cold | nostter 5 | 4942.2 / 5409.0 / 6842.2 | 8258.9 / 8258.9 | 0.11489 / 0.11489 | 0 |
| Cold | lkjstr 5 | 908.6 / 1158.6 / 1158.6 | 5308.4 / 5298.4 | 0.12667 / 0.17843 | 0 |
| Warm | nostter 4 | 565.3 / 1348.5 / 1348.5 | 3281.8 / 44230.2 | 0.03223 / 0.13985 | 4 |
| Warm | nostter 5 | 366.1 / 1299.3 / 1299.3 | 3265.9 / 44004.4 | 0.11679 / 0.41403 | 9 |
| Warm | lkjstr 5 | 552.6 / 702.5 / 702.5 | 3285.8 / unavailable | 0.84720 / 1.29137 | 7 |

DOM readiness is sampled on consecutive animation frames, not compositor
presentation. Final rest is the last geometry/shift timestamp plus 2000 ms;
first rest is the frame on which that quiet interval was observed. A final
value slightly earlier than first rest can therefore be ordinary frame sampling.

## Invalid phone pair

The synthetic profile was 393x852, DPR 2, mobile/touch, page CPU 4x, network
150 ms / 200000 bytes/s down / 93750 bytes/s up. This is not calibrated physical
mid-range hardware; worker CPU, GPU and disk equivalence are unestablished.

Nostter's dedicated verification worker returned Not supported during mobile
CDP setup. Its diagnostic note/rest values were 14915.2/17981.7 ms, with six
main-thread long tasks totaling 487 ms, but they cannot enter a valid paired
comparison. lkjstr recorded 12058.2/17774.7 ms and two tasks totaling 179 ms.
Both strict screen/ten marks were unavailable: the actual first rows included
named authors with existing avatar fallbacks. Settled-author marks were
21431.6 ms for nostter and 20057.8 ms for lkjstr; they do not replace pictures.
The failure and missing marks are retained. A repaired phone setup requires a
new explicit measurement; it cannot retroactively validate these observations.

## Exact input, serving and qualifications

The immutable production-format candidate is e636bbe2b69a74465bc5627611ef47ec5df7a2c3,
packaged by the account-safe ship attempt that stopped before host deployment.
It was not live; live still served 541e4a1e. The 1601709-byte ship archive SHA-256:
c717fc584f7d414dc9a4f60a0f25bc86b9b0756b80ce8107d2837d37966bd967.
Its 34-file manifest includes index SHA-256
5d2a021fdbe20c4a712159bece24839a78b125defc7f25ea0954250488134ec2.
The harness was e4be15d52b4900ed805cd5e1f3dc9d49f8b2826a, frozen before timing.

lkjstr used its exact files at http://127.0.0.1:41047 with production MIME,
CSP, cache and gzip policy; nostter used its public CDN. The lkjstr WAN/TLS leg
is omitted, so this comparison does not establish live-site transport parity.
The same owned SSH route repaired only lkjsxc.com/lkjstr.lkjsxc.com reachability
for both readers, with original URL, SNI, valid certificate and response bytes.
The avatar probe took 16.364 ms. All 22 browser response witnesses retained
the original 18467-byte image's matching hash and TLS 1.3 response. Each reader
received local-network-access only for its measured origin to permit the
forward's artificial loopback classification. No security flag was disabled.

Two small shell/Git fixture tests overlapped the first pair's later observation
windows, after their opening marks: estimated 01:04:34.201-01:04:38.498 and
01:05:24.660-01:05:29.874 UTC. No browser, Cargo build or network fixture ran
there. These samples were kept, with the overlap recorded; shared-host load
was not controlled.

## Evidence and cleanup

All 22 observations retained public-only account/guard witnesses and zero
forbidden outbound frames. Desktop page/CDP error lists were empty.
The owned route closed at 01:24:34.788 UTC. A 01:27:05 UTC independent check
found no owned race/Chrome/SSH process and ECONNREFUSED on ports 41047/36821.
Cleanup succeeded. Two closed public foundation profiles remain.

Artifacts: tmp/open-race-tree/tmp/race-baseline-e636-20261117 contains
report.json/report.md, analysis.json, all screenshots, frozen dist/harness,
public account/verifier, route evidence, ship-archive-provenance.json,
environment-overlap.json, deployment-status.json and cleanup-proof.json.
The input copy is tmp/open-race-tree/tmp/race-e636-input-20261117.
Preserve these artifacts before removing the integration worktree.
Reproduction and metric definitions are in [race-open.md](race-open.md).
