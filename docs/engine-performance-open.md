# Open-race evidence

## Purpose

## Incomplete normal-route diagnostic

This record is not a completed comparison or a performance victory.
The requested matrix was five cold and five five-minute reopenings per client,
then one throttled phone run each. It stopped after the third completed warm
pair because both apps waited on the same public avatar over an unreachable
workspace route. All 13 finished observations remain; no failed or slow row was
dropped. Every five-run median is unavailable. The phone case did not run.

- Date: 2026-11-16 23:46:45.366-23:57:07.128 UTC.
- Initial load average: 10.00/8.28/6.72.
- Last completed observation load at 23:57:06.979 UTC: 8.24/7.70/7.16.
  The aggregate report's later cleanup sample at 2026-11-17 00:04:31.632 UTC
  was 8.63/8.78/7.91; it is not a run-end sample.
- Browser: headless Chromium 153.0.8010.12, one browser at a time.
- lkjstr candidate: 04c10b9b; index SHA-256
  0a3f01562c9622148c6b167fd019ded84e35c34f2913999a0aaa1cb423e732c1.
- Frozen harness: 8003850d. Observation window: 45 seconds per navigation.
- Same read-only public account: SnowCait, 309 verified follows,
  npub1s02jksmr6tgmcksf3hnmue7pyzlm0sxwarh7lk8tdeprw2hjg6ysp7fxtw.
- Cold: identity only, no event/metadata/HTTP/SW cache. Public preflight events
  were not imported. Fresh browser process after setup, no signer.
- Warm: the scheduler waited 300.000-300.006 real seconds from observation end
  to the next browser launch. Navigation followed that launch; precise
  closed-browser-to-navigation idle was not recorded in this old diagnostic.
  Public events, HTTP cache and SW state were retained; no clock aging.
  The corrected harness records actual close and navigation timestamps.
- lkjstr exact release bytes used a fresh loopback server with production
  MIME/CSP/cache/gzip policy. Nostter used https://nostter.app and its public
  CDN. This omits lkjstr's live WAN/TLS leg, so it cannot prove transport parity.
  This old server mishandled weak gzip ETag revalidation, potentially inflating
  warm HTTP transfer. The later baseline corrects it; these raw bytes stay.
  Its observation ends 45 seconds after commit, including earlier transport.

## Completed raw observations

Times are milliseconds from document navigation. First rest is the first
two-second quiet interval; final rest shows later movement. CLS is the standard
session-window score; total shift is the sum of eligible shifts. Bytes are
HTTP encoded transfer / WebSocket UTF-8 payload, excluding WS framing/TLS.
No main-thread long task over 50 ms was observed in these desktop windows.

| Situation | Client/run | First note | First rest | Final rest |
| --- | --- | --- | --- | --- |
| cold | nostter 1 | 5317.4 | 7484.0 | 7467.4 |
| cold | lkjstr 1 | 611.2 | 3361.1 | 23679.5 |
| cold | lkjstr 2 | 710.5 | 3243.8 | 40494.9 |
| cold | nostter 2 | 5149.1 | 7399.1 | 26268.3 |
| cold | nostter 3 | 6245.5 | 8345.4 | 8343.8 |
| cold | lkjstr 3 | 728.4 | 3461.6 | 41763.1 |
| cold | lkjstr 4 | 1045.4 | 5378.5 | 21897.3 |
| five-minute | nostter 1 | 522.0 | 2588.5 | 41291.6 |
| five-minute | lkjstr 1 | 608.1 | 3424.7 | 41776.4 |
| five-minute | lkjstr 2 | 603.3 | 3353.2 | 43738.0 |
| five-minute | nostter 2 | 671.8 | 2688.4 | 2679.0 |
| five-minute | nostter 3 | 493.8 | 2510.4 | 39494.9 |
| five-minute | lkjstr 3 | 545.1 | 3361.6 | 34247.8 |

| Situation | Client/run | CLS / total shift | HTTP / WS bytes | Post-rest shifts |
| --- | --- | --- | --- | --- |
| cold | nostter 1 | 0.0225 / 0.0225 | 3317035 / 2134267 | 0 |
| cold | lkjstr 1 | 0.0518 / 0.0657 | 5452732 / 712838 | 1 |
| cold | lkjstr 2 | 0.0667 / 0.2865 | 5450152 / 850813 | 5 |
| cold | nostter 2 | 0.0367 / 0.1193 | 3281643 / 2139568 | 3 |
| cold | nostter 3 | 0.0232 / 0.0232 | 3321111 / 2144997 | 0 |
| cold | lkjstr 3 | 0.0522 / 0.0870 | 5382322 / 715355 | 1 |
| cold | lkjstr 4 | 0.0522 / 0.1342 | 5382853 / 845042 | 1 |
| five-minute | nostter 1 | 0.0414 / 0.0981 | 67947 / 1393651 | 2 |
| five-minute | lkjstr 1 | 0.8687 / 0.9850 | 32967 / 911688 | 3 |
| five-minute | lkjstr 2 | 0.8475 / 0.8992 | 32703 / 768600 | 1 |
| five-minute | nostter 2 | 0.0225 / 0.0225 | 69019 / 1373440 | 0 |
| five-minute | nostter 3 | 0.0362 / 0.0845 | 28331 / 1384930 | 2 |
| five-minute | lkjstr 3 | 0.6797 / 0.7363 | 17545 / 753197 | 2 |

First-screen, first-ten and both settled-author secondary marks were unavailable
in every row. The first ten DOM notes were never replaced by later hydrated
notes. The blocking original URL was
https://lkjsxc.com/kjkvgy4anzctrhjllpwxzc3m4q/file. It remained pending, with
naturalWidth zero, through the observation on both clients; a pending picture
is not a terminal no-picture fallback.

Warm lkjstr first relay replies arrived at 254.7/214.5/213.3 ms; observed ordinary
engine-ready messages arrived at 140.6/100.1/93.5 ms. The first Home note arrived
later in every run. SW controlled all three lkjstr warm navigations, with nine
SW responses each. Warm WS EVENT counts were 834/679/669, compared with
558/746/562 for their cold profiles. These observations do not establish the
300 ms pre-relay first-screen target or the repeat-fetch budget.

## Provenance and cleanup

Artifacts are under
tmp/open-race-tree/tmp/race-baseline-20261117 in the stream worktree.
report.json retains the complete observations, image/author diagnostics,
per-run date/load, profile ages, protocol guards, network witnesses and source
hashes. report.md is explicitly marked incomplete. The directory also contains
the byte-identical build, copied harness, public verifier and screenshots.
The two public-only foundation profiles remain as evidence. Preserve these
artifacts before removing the integration worktree.

The owned browser process and local server were closed at the stopping point.
Cleanup found no remaining race Chrome process, and the owned server port
returned ECONNREFUSED. The one queued intermediate profile was removed.
No owner profile, signing key, public publication or host service was involved.

## Reachability correction for the next run

A separate valid-TLS probe through the actual edge reached the original avatar
with status 200, image/png, 18467 bytes. Its SHA-256 was
0bb202e4e35ad6e8961ead8e96ddb58b89b05f5a469d46e52cf959a8c8ec31b5.
The next run uses the explicit owned route described in [race-open.md](race-open.md),
with the same host mapping for both clients. This preserves URL, SNI,
certificate and body; no image is substituted. Route latency and Chrome's
actual response witness will be recorded. This later route cannot retroactively
complete or change the diagnostic observations above.

A real one-hour Home-scroll working set per client is a separate measurement.
It is not a full day, and does not establish ordinary profile/thread/list/
notification/message coverage. A full matrix and all-warm-cache victory remain
unmeasured at this checkpoint.
