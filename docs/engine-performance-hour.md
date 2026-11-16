# Corrected public hour and coverage audit

## Purpose

Record the completed 2026-11-16 public-network hour, memory attribution, recovery
witnesses and the route-coverage defect it exposed. This extends
[engine-performance.md](engine-performance.md) and its
[earlier public audit](engine-performance-public.md). All times are UTC.

## Artifact and workload

The real build was frozen at 05:29:19 from base `6830584c` with the first paging
and failed-route fixes. WASM SHA-256:
`0b759ee90a85e1faa7f12cada44b50c53e6bb30303e005fd726a810d086ab7c0`.
This artifact predates later authentication identity, offline-shell and healthy
fallback preservation changes; the hour does not validate those later changes.
The command was `node scripts/real-hour.mjs --seconds=3600 --scroll-notes=2000
--helpers=existing --build=tmp/real-hour-fixed/dist
--account=dd844857fcfbdc12631dcd96efdf3db259df466531f9bbca2fda6fa5a5b13f8a
--output=tmp/real-hour-20261116-corrected`.

For a new run, start `node scripts/real-hour-gap-audit.mjs tmp/<run-name>` after
the main command reports live startup. The optional companion waits for the
completed hour, validates run ownership/source/helper hashes, and observes only
that owned browser. It writes a distinct `gap-audit-<timestamp>/` directory.
New runs require a fresh output directory inside this worktree `tmp/`; existing
profiles and symlink escapes are rejected. No default gate starts public probes.

Live observation ran 05:58:06.401-06:58:06.489, exactly 3600.088 seconds, with
61 samples. Fault phases finished 07:12:16.292; the process exited successfully.
First live load was 7.25/7.07/7.45; last 8.82/9.48/9.89. One-minute load ranged
3.11-17.76. Final post-fault load was 11.22/9.45/9.53. Copied assets, helper
binaries, harness hashes and raw reports remain in the output directory.

Cold Global DOM note/name/loaded-avatar appeared at 351/453/453 ms. Home after
public npub import reused Global's cache and appeared in 143 ms. Warm Home
note/name/avatar was 486/587/486 ms. Polling resolution is 100 ms; loaded image
dimensions are checked, but these are not compositor paint timestamps.

Scrolling reached 2004 distinct rendered notes in 51971 ms. The 80 polling
steps had median/max 614.5/1025 ms, including intentional 600 ms waits. There
were 55 new-row batches, median/max observed wait 682/2221 ms. The hour counted
212938 rAF intervals, 407 over 34 ms and 179 over 100 ms; longest was 683.2 ms.
These intervals measure main-thread stalls, not exact display-frame drops.

## Memory and resource bounds

Values below are decimal MB from unforced-GC snapshots, not process RSS.
Page/Worker JS, embedder heap and WASM linear memory are separate measurements.

| Measurement | First | Last | Minimum | Maximum |
| --- | --- | --- | --- | --- |
| Page JS heap, MB | 4.739 | 13.981 | 4.739 | 36.813 |
| Page embedder heap, MB | 22.834 | 88.270 | 22.834 | 337.977 |
| Worker JS heap, MB | 1.143 | 8.813 | 1.143 | 8.858 |
| Worker embedder heap, MB | 1.370 | 2.769 | 0.491 | 7.736 |
| Worker WASM linear memory, MB | 3.604 | 65.274 | 3.604 | 65.274 |
| Physical IndexedDB events | 32 | 9929 | 32 | 9929 |
| Browser storage estimate, MB | 0.072 | 12.333 | 0.072 | 14.615 |

WASM reached 65.274 MB at the +52.125 s sample after archive acquisition and
stayed there for the rest of the hour. Worker JS over the final ten minutes
ranged 7.669-8.858 MB. Interned query strings still contribute observer memory:
2904991 retained characters at hour end. This removes the earlier repeated-array
attribution error; it does not isolate every observer byte or prove indefinite
stability. Storage fell after its peak, so its growth was not monotonic.

Sampled sockets/requests peaked at 8/32. This observer predates immediate
server-CLOSED removal from its request counter; that figure is a client-tracking
bound. Query evidence dropped zero records. Source/window maps stayed at 3/5
and Home retained 2329 observed IDs, below 128/40000 caps. This copied probe
predates the final ID/source-drop counters; those limits were checked explicitly.
Page errors and forbidden outbound frames were zero. No public EVENT/AUTH was
sent. Owned browser/server processes exited and all owned profiles were removed.

## Same-source controls and intended coverage

The unchanged verified follow list gives 243 Home authors including self.
The control window was `1794808686..1794812286`. Native signature and eligibility
checks accepted 9931 unique public events, rejected zero, and applied available
mute/deletion/feed rules. Private mute content remains unavailable to an npub.

| Source control | Relay | Returned | Result / elapsed |
| --- | --- | --- | --- |
| Home | yabu.me | 3 | EOSE / 214 ms |
| Home | Damus | 0 | CLOSED / 241 ms |
| Home | theforest | 1 | EOSE / 787 ms |
| Home | Azzamo | 0 | EOSE / 1113 ms |
| Home | nos.social | 5 | EOSE / 775 ms |
| Notifications | nos.social | 1 | EOSE / 708 ms |
| Notifications | Azzamo | 0 | EOSE / 1098 ms |
| Notifications | Primal | 2 | EOSE / 1085 ms |

Home had five distinct eligible control notes: three were seen, two were not.
Notifications had two distinct notes, one eligible and seen; the other was
excluded by native eligibility. Thread focus
`f157b1400833d2fed5c169e39bd25914c318d1d42e207b583a2d2660068e05b6`
used exact kinds `[1,42]` and one `#e` target. Azzamo returned zero/EOSE in
1101 ms, Primal one/EOSE in 1097 ms; its single eligible reference was observed.
Deeper thread replies without that tag and grouped notification constituents
remain outside these comparisons.

The absent Home notes are coverage-gap candidates, not evidence of a delivered
EVENT being discarded. A closed request does not excuse losing unchanged Home
intent. Their public IDs and event timestamps are:

| Public note ID | Created |
| --- | --- |
| `0000026f74c1b6305565d354e564d6af79558b684eb317fead47f9f18011f8a8` | 06:36:44 |
| `d93d2fa569df74b9ca2751fb709e3339924a60b17fc589a1315f77cd77f15f2f` | 06:42:27 |

Both controls found them on nos.social; the first was also on startup-only yabu.
Per-event first control receipt was not retained: the defensible interval is
06:58:06.489-06:58:23.909. Nos.social Home request `w1980`, all 243 authors,
kinds `[1,6]`, limit 200 and no time bounds, began 06:21:51.613, answered EOSE
06:21:52.737 and received client CLOSE at 06:21:57.176. At that same instant,
theforest `w2031` resumed those authors with `since:1794805215`. Azzamo continued
with `since:1794582555`. Nos.social had no later Home request during the hour.
Home stayed visible, anchored at top with `after:800`; follows did not change.

At 07:08:30.982, during the later ten-minute cut, both notes were absent from the
browser's events store and all-ever Home row IDs, excluding a merely off-window
cache explanation at that observation. After reconnection they were cached and
observed by 07:10:12.599. Exact queries, native-verified public payloads and cache
checks are preserved in `home-gap-triage.json`, `home-gap-cache-membership.json`
and `gap-audit/` under the run directory.

A deterministic native regression reproduces the relevant scheduler failure:
A/B own live slots; B fails; C supplies a healthy fallback; B recovers; unchanged
planning closes C solely because B occurs earlier in configured order. Its
before-fix output is `tmp/real-hour-head-recovery-before.log`; all eight focused
route/history/recovery tests passed after preserving explicit primary-slot
ownership (`tmp/real-hour-head-recovery-after.log`). Recovery waits for its own
fresh EOSE and then retires, without displacing a working fallback. Permission
removal and hiding the last view release the retained work. This confirms a
mechanism matching the wire transition; it does not recover missing per-event
relay acceptance timestamps. The two public notes remain coverage candidates. A separate normalized-profile
bucket regression also failed before preserving existing hydration route
stability; its before/after logs are `tmp/real-hour-hydration-slot-before.log`
and `tmp/real-hour-hydration-slot-after.log`.

Home uses two ordinary reader routes, not complete replication
across all configured relays. Recovery/history routes retain independent unknown
spans outside those slots, bounded by configured transports. Exact request
lifetimes explain delivered-event attribution but do not establish global
coverage or make eligible union gaps disappear.

## Faults and delivered recovery witness

Cuts lasted 30.281 and 603.120 seconds; subscribed socket/REQ recovery was 1533
and 4056 ms. Those timings alone do not prove note delivery. A separate bounded
sidecar began after the full hour and observed the ten-minute gap. Its three
controls used actual responsive Home/notification routes: Azzamo, theforest,
nos.social. Home returned one eligible note, all controls EOSE; notifications
returned no eligible note, so notification gap completeness is unknown. The
thread had already closed before the outage, so no thread-gap claim is made.

Outage note `9736e503f2d92b6fc306bac2ee95264be60771a576cfaa86b6c713877d136bf4`
was created at 06:59:33. The exact retained EVENT payload from nos.social was
natively verified and arrived at 07:09:42.043, 6858 ms after the recorded resume
lower bound. Its ID was observed in Home by the 07:10:12.599 capture. Thus this
one note has delivered recovery evidence; it is not a universal recovery bound.
The sidecar dropped no evidence, reported no errors, detached only its own CDP
sessions and closed all direct control sockets. Reports are in `gap-audit/`.

Page-only freeze lasted 30.014 s while SharedWorker stayed active, with 3 ms
connectivity recovery; this is not engine sleep. Closing the first SharedWorker
tab preserved connectivity in 241 ms. A separate SharedWorker-disabled profile
proved dedicated-leader replacement with a different Worker target in 514 ms.
Physical cache boot seeded exactly 20000 signed fixture rows in 672.8 ms;
first profile note appeared in 337 ms, with no public relay configured.

The separate engine pause ran 07:11:38.120-07:12:15.289: actual engine Worker
execution paused 30.051 s, page frozen 30.000 s, Worker wall-clock gap 30.100 s,
subscribed recovery 3027 ms. Only owned sockets/HTTP and targets were affected.
Service workers were blocked because initial-execution guards are unsupported
for them here. This is scoped suspension, not host/OS sleep or offline-shell
verification. Warm reload completed afterward within the main cleanup lifetime.

The later loopback verification-pressure finding, bounded retry state and native
before/after proof are documented in
[verification pressure](engine-verification-pressure.md); they are not attributed
to the frozen public hour without evidence.
