# Public engine measurement audit

## Purpose

Preserve public-relay control attribution, raw artifact locations, limitations
and reproduction details behind [engine-performance.md](engine-performance.md).
All dates below are 2026-11-16 UTC. Public event fixtures never contain account
storage or private keys. No test sends EVENT, AUTH or any message except REQ/CLOSE.

## Reproduction and identities

From the repository root, run `pnpm real:hour`; set `LKJSTR_WASM_BINDGEN` to the
installed binary as for `pnpm build:real`. All build/test caches remain in the
worktree; native compilation/test jobs are capped at four. The harness copies
release files, helper binaries and its own source, and records SHA-256 hashes.
Native helpers verify signatures and apply the engine's actual eligibility
rules offline. The UI imports only a public npub into a fresh profile.

Baseline artifacts: `tmp/real-hour-20261116-v3/report.json`,
`public-control.json`, `stall-evidence.json`, `stall-public-events.json`,
`diagnostics-midrun.json`, `thread-query-evidence.json` and `audit-correction.json`
in that same directory. The baseline WASM SHA-256 is
`2cf84800c63b8c4abf99301cce9b4501a96934d8fd0cdd5b0b24829fdbfb2259`.
The baseline is the real build of `6830584c`; harness work made the tree dirty.

Fixed short artifacts: `tmp/real-hour-20261116-fixed/report.json` and
`public-control.json`. Its frozen source build is `tmp/real-hour-fixed/dist`;
`tmp/real-hour-fixed/build.json` records 05:29:19 UTC capture, load
7.23/7.76/7.46 and base `6830584c` with uncommitted fixes. Fixed WASM SHA-256:
`0b759ee90a85e1faa7f12cada44b50c53e6bb30303e005fd726a810d086ab7c0`.
Short check command: `node scripts/real-hour.mjs --seconds=300 --scroll-notes=2000
--helpers=existing --build=tmp/real-hour-fixed/dist --output=tmp/<new-name>`.

The chosen public account is
`dd844857fcfbdc12631dcd96efdf3db259df466531f9bbca2fda6fa5a5b13f8a`.
Its verified follow list contains 242 people; Home also includes itself, giving
243 authors. Initial and final follow event were identical:
`8dad56beeb96019ed61ac097fbe1d0876c0004d1fcab811ab7c12fa0755e17e8`.
Its public mute tags contained no exclusion. Private mute content remains
unreadable for this npub and cannot silently be treated as an available list.

## What the controls establish

The primary Home control asks the actual source routes for direct kind-1 notes,
with the same author set and event-time window. Native eligibility applies
mutes, deletion and feed filters. Notification control covers direct kind-1
mentions/replies: grouped reactions, reposts and zaps do not expose constituent
IDs through existing rows and cannot be compared with equal confidence.
Row observations retain IDs from full rows, patch insertions and updates,
including later-removed rows. Missing candidates require route-lifetime and
request-filter evidence, not merely a relay having appeared earlier in a run.

The current observer records each subscription, filter, EOSE and closure. Source
selection requires exact relevant kind sets and tag targets. Filter payloads are
interned with a 1024-payload / 4 Mi-character bound; query records stop at 10000.
Each source retains at most 40000 observed IDs; source/window maps cap at 128.
Dropped query, ID and source/window evidence is explicit and makes completeness
unknown. Observer guards preserve all underlying protocol forwarding. Public controls
limit pages, returned events and frame size. Rate-limit/closed/error results
remain visible. EOSE describes the relay's answer, not all events on Nostr.

Baseline event-time window: `1794803099..1794806699`. Home initially requested
yabu.me at live +0.332 s; Azzamo began +1.279 s and persisted; Damus began
+22.551 s but failed. Yabu was only a startup source route after relay-list
replacement. Existing baseline query records lack full subscription lifetimes;
no later note from that startup route proves steady-route delivery loss.

| Baseline primary control | Eligible notes | Result / elapsed |
| --- | --- | --- |
| Home, yabu.me startup route | 3 | EOSE / 97 ms |
| Home, Azzamo steady route | 0 | EOSE / 1102 ms |
| Home, Damus failed route | 0 | HTTP 521 / 140 ms |
| Notifications, Azzamo | 0 | EOSE / 1101 ms |

The original report labels the three yabu notes `missingCandidates`. The
companion `audit-correction.json` retains those observations and classifies them
as startup-route coverage uncertainty, not proved steady-route loss. Query-time
membership and relay availability must be reproduced before promoting a claim.

The supplemental wider relay union returned 13 eligible Home notes, 12 unseen.
Two early independent nos.lol candidates were signature-valid and absent from
both cache and Home at a later inspection. Nos.lol was not an actual Home
source route, so these are acquisition-coverage gaps, not same-route losses.
Public IDs remain in the ignored raw reports; no private owner data was used.

At 05:01:51 diagnostics showed Azzamo Home request complete with 200 received,
Damus incomplete with zero; Damus was waiting after socket close 1006 with zero
quality. Permitted Primal/theforest readers were connected. The account's relay
list permits theforest, Azzamo, Damus, nos.social and Primal for reads; premium
Primal and nostr.mom are write-only. The fix must not expand into write-only
routes simply to improve a control score.

Fixed short control window: `1794807022..1794807322`. Home controls returned
zero notes with EOSE from yabu (242 ms), theforest (667 ms), Azzamo (1114 ms),
and CLOSED from Damus (166 ms). Notification controls returned zero with EOSE
from nos.social (905 ms), Azzamo (1099 ms), theforest (637 ms). Zero candidates
in this low-traffic sample are weak evidence; they do not certify completeness.

## Thread attribution correction

Focus ID: `6974ec2e11a4e1cd217ea55a7161c7188ece1ceaf1aa55d07d67874b7b56014e`.
At 05:25:15.710 the actual thread source sent kinds `[1,42]` with singleton
`#e` focus to Azzamo and nos.social. Both independent controls returned zero
with EOSE, in 1105 and 734 ms. Broader count hydration used kinds
`[1,6,7,9735]` and 128 IDs, including that focus, on other relays.

The original probe incorrectly counted Primal hydration as a thread route.
Primal returned two native-eligible references, one unseen in the thread.
That is supplemental availability evidence; it is not proved thread-source
loss. The current probe requires both exact kind-set and target-set equality.
Direct focus-tag references are covered; deeper replies that omit the focus tag
remain outside this control. The original report and corrected audit coexist.

## Reproduced archive and route failures

The baseline archive stalled at 808 visible notes. Cached eligible membership
was 812, consistent with a few unavailable repost targets, not thousands of
cached rows hidden by the frontend. Public signed-event snapshot contains 3156
events. Its newest timestamp was one second before live start; the separately
fixed future-event reconnect watermark bug does not explain this sample.

Before-fix native logs: `tmp/real-hour-paging-before.log` has three failures;
`tmp/real-hour-head-before.log` has two. Final targeted results are in
`tmp/real-hour-paging-final.log` (17 passed). Regressions cover closed/silent
route progress, incomplete partial-page cursors, retrying the preserved gap,
in-flight request identity, permission-aware healthy fallback and uncertainty
preventing false exhaustion. Recovery never overwrites an unfinished route's
filter with another route's older cursor. Source/test paths are under
`crates/lkjstr-core`; public captured events are optional reproduction evidence,
not a dependency of deterministic native tests.

## Instrumentation limits and corrected hour

The first baseline observer retained 5689 query entries totaling 33483038 bytes
when serialized; 523 distinct filter payloads totaled 2787766 bytes. It did not
intern repeated arrays. Baseline Worker JS growth to 41986352 bytes therefore
cannot be attributed to the product. Page/Worker JS, embedder heaps, WASM linear
memory and browser storage estimates measure different things; none is total
process RSS. No forced GC was used. One hour cannot prove indefinite stability.

The five-minute fixed run still used that older query representation (685
entries / 3789832 serialized bytes). Page JS first/last/max was
5036008/11140036/40869888 bytes; Worker JS 1353192/6690388/14835600 bytes.
Linear memory grew from 3538944 to 67043328 bytes while physical cache rows
rose 32 to 8373. Short-run growth alone does not establish an unbounded leak.

The first extra pause attempt, `tmp/real-hour-20261116-worker-pause`, completed
but its 80.006 s reported recovery included service-worker inspection timeouts;
its engine was paused 70.073 s and page 30.004 s. It is not a recovery benchmark.
The second, `tmp/real-hour-20261116-worker-pause-clean`, failed closed at a
service-worker Debugger.enable timeout before pausing. Raw reports are retained.
Playwright now blocks service-worker registration for public measurements.
An unexpected such target is closed fail-closed. This browser capability choice
excludes offline-shell behavior, which has a separate loopback smoke gate.

The successful scoped repeat is `tmp/real-hour-20261116-worker-pause-scoped`:
actual engine SharedWorker pause 30.051 s, page freeze 30.002 s, clock gap
30.098 s, subscribed relay recovery 3062 ms. Service workers were blocked;
no host sleep/network controls were used. Finally blocks resume owned targets,
close the browser/server and remove profile data on success or failure.

`tmp/real-hour-20261116-corrected` began 05:58:06.401 with bounded/interned
probes against the frozen fixed WASM; load 7.25/7.07/7.45. It will observe 3600
real seconds before extra fault scenarios. Its hour-memory result is pending.
This running copy predates the final source/ID drop counters; its source/window
and observed-ID counts are checked against those limits explicitly. Query drops
were already reported. New runs include every drop counter; nine observer tests
pass, including two cap regressions that failed before the correction. Initial
subscription counters retained server-CLOSED IDs until client CLOSE; the current
probe removes them immediately. Older maxima are client-tracking bounds.
The baseline's completed hour and instrumentation defect remain in the record.
