# Open race

## Purpose

Compare a frozen real lkjstr build with the public nostter Home in one Chromium
build on one shared host. The command is outside all default gates and never
builds, signs, publishes, or opens an owner's profile.

## Run

Build the release separately, then:

```sh
pnpm race:open --build=dist --verify-helper=target/debug/examples/engine-public-verify
```

The verifier can be copied from an existing owned real-hour report's bin
directory; its hash is recorded. No native compilation is hidden in the race.
The default is five runs per desktop situation and one cold phone run per
client. For the initial cold/five-minute/phone baseline:

```sh
pnpm race:open --build=dist --verify-helper=PATH \
  --situations=cold,five-minute,phone --output=tmp/race-baseline
```

For a short harness calibration only, use --runs=1 --duration-ms=15000
--situations=cold. This is not the five-run baseline.

The default public account is SnowCait, nostter's author. A separate read-only
preflight verifies a current kind-3 signature and at least 100 follows. If this
default is unavailable, the command may choose another verified busy public
account, recording why; an explicit --account=npub or 64-hex key never changes
silently. Exactly the same account is used for both clients. No preflight event,
profile, follow list or relay result enters browser storage.

## Situations

- Cold: an owned blank context seeds only the public identity; no app code or
  network request runs. That browser closes. A fresh process then navigates to
  Home with no event, metadata, HTTP or SW cache. This excludes interactive login
  and includes each client's ordinary account/follow discovery.
- Five-minute: each cold profile closes and reopens after 300 real seconds. A
  due-time queue prioritizes these reopenings over new cold runs. Actual idle
  seconds (closed browser to next navigation) and profile age are recorded per
  run; no clock is changed. Browser launch delay is retained separately.
- Day-use workload: each client's public profile scrolls Home for 3600 real
  seconds, then five new processes open copies of that closed working set.
  This is explicitly an hour's Home workload and recorded profile age, not a
  full day's ordinary use. Profile/thread/notification/list/message visit
  coverage is not established by this workload.
- Synthetic phone: 393x852, DPR 2, touch/mobile mode, 4x page-main-thread CPU
  slowdown, 150 ms network
  latency, 200000 bytes/s download and 93750 bytes/s upload. Network shaping is
  applied by Network.emulateNetworkConditionsByRule to the page, engine/verification
  workers and SW targets, retaining returned rule IDs and affected-request counts.
  Dedicated-worker navigator state is not explicitly overridden: Chromium rejects
  the combined command there. Exact
  emulated UA, actual Chromium and Playwright builds are recorded. Worker
  CPU, GPU, disk and physical mid-range-device equivalence are not established;
  this is not a calibrated hardware benchmark. See
  [Chrome's throttling explanation](https://developer.chrome.com/blog/devtools-grounded-real-world).

The paired desktop order alternates by run. At most one browser is open.
After a closed baseline, its two owned public-only foundations can be reused:

```sh
pnpm race:open --build=dist --verify-helper=PATH \
  --profiles-from=tmp/race-baseline --situations=day-use
```

Profile ownership, canonical paths and each foundation's completed read-only
source observation/workload are checked. An unrelated failed phone case does
not invalidate a proven closed public profile: the original matrix status is
retained explicitly in the new report and never changed. A local origin reuses its previous owned port only if free;
the command never stops another process. Intermediate profiles are removed;
only two bounded-purpose foundation profiles remain for the next measurement.
A deeply nested worktree needs --temp-dir=<short-project-tmp-path> because
Chromium's Unix-domain socket path has an operating-system length limit.

## Marks

All values start at the timed document's performance.timeOrigin. DOM visibility
is observed at animation frames and confirmed in the following frame. These are
paint opportunities, not compositor presentation timestamps.

- First note: text in a visible top-level Home note.
- First screen: the viewport is filled and every intersecting note has a
  non-key name and decoded non-placeholder author picture.
- First ten: the first ten top-level Home note rows in DOM order have names and
  decoded non-placeholder pictures. Slow rows are never skipped. A separate
  literal ten-in-viewport mark may be unavailable at ordinary screen height.
- Settled-author secondary marks: names are present and each avatar is decoded
  or has reached the client's existing no-picture/error fallback. Reasons,
  failed image URLs and affected public row IDs remain in the report. These
  never replace the strict picture marks.
- Rest: two seconds without a viewport-note geometry change or eligible layout
  shift. Final-rest and post-rest shifts expose late movement.
- FCP, cumulative session-window CLS, sum of eligible shifts, long-task count
  and duration, first relay reply/event, engine ready when an ordinary ready
  message is observable, SW controller/registration/cache evidence and bytes
  use the same observation, which ends 45 seconds after navigation commit by
  default; navigation-to-commit transport is also included. Long tasks are page
  main-thread observations, not a count of engine-worker tasks.

Names inferred only as raw keys remain unresolved. A previous raw-key spell in
this measurement is not automatically a previously known author; the report's
rawKeyOver100Ms counter is a per-row observation, not the section-3 cache claim.

A missing mark or invalid run makes its median unavailable. Five-run medians
never discard a failed or slow run. Live public images may be absent or fail;
the report retains that fact instead of replacing the account or selecting
later hydrated notes.

## Serving and instrumentation

By default the exact supplied release files are copied, SHA-256 inventoried and
served on loopback with the production nginx MIME, CSP, immutable/no-cache and
gzip policy observed at bootstrap-infra 33ea5fa. Gzipped assets retain weak
ETags and accept weak If-None-Match revalidation with a 304 response. The document never sends an
ETag; missing dotted files return 404. --lkjstr-url=https://... uses the live
origin instead; a TLS-verified preflight requires its index hash to equal the
supplied release. The manifest and observed index witness are recorded.

Loopback shell delivery lacks the production WAN/TLS leg. Nostter traverses its
public CDN. Relays use the same host and network, but this local comparison
cannot establish a live-site transport victory. The report names this limit.

When the workspace cannot reach the two lkjstr public origins, explicitly use
--host-route=archserver. This starts one owned, non-multiplexed SSH TCP forward
through root@archserver to the actual edge at 10.203.47.10:443. Both clients get
the same Chrome host mapping for lkjsxc.com and lkjstr.lkjsxc.com; other hosts
remain on the ordinary workspace route. Chrome's artificial public-to-loopback
classification requires local-network-access; each owned profile grants it only
to its measured app origin, symmetrically for both clients. No security flags
are disabled. The public nostter-origin image failed with
LocalNetworkAccessPermissionDenied without this permission and decoded after
the scoped grant. openBrowser callers using hostResolverRules must pass base.
Original URLs, TLS SNI/certificates and
response bytes are preserved. A valid-TLS avatar probe records its hash and
latency. Passive Chrome evidence records TLS/endpoint/cache source, and reads
the same avatar response's hash after the timing window when its body remains
available. No image is replaced and no host configuration changes. The route is
closed and its listener checked after the run. This correction is reported
separately from the normal-route diagnostic, never applied retroactively.

SIGINT, SIGTERM or SIGHUP requests a stop after the current fixed observation.
Interrupted runs keep their raw evidence and remain incomplete; missing runs
cannot acquire five-run medians. Owned browsers, pending profiles and the SSH
route are closed. The workload loop also checks the stop request each second.

Both clients receive the same small Blob worker trampoline: a synchronous
REQ/CLOSE/COUNT/negentropy-only send guard, bounded initial-message queue and
import of the original byte-identical release module. All startup overhead is
included. No signer or secret is installed. CDP enables network observation
before page/engine/verification targets run; measured capture delays are kept.
Chromium cannot answer Network.enable before an initial SW context runs, so SW
resumes first and is observed passively. SW source is not replaced; HTTP cache
and SW behavior remain enabled. A SW capture error is retained and limits byte
completeness. Outbound EVENT/AUTH and malformed messages are blocked.

HTTP encoded transfer bytes and WebSocket UTF-8 payload bytes are reported
separately. Their sum excludes WebSocket framing, TLS and message compression
overhead. The reusable CDP observer also offers listenNetwork(fn), with live
Network events, host observation timestamps, a disposer and at most eight
listeners; it buffers no event bodies for subscribers and clears them on close.
Instrumentation retains counts, public IDs, image URLs and bounded
timing samples, not private bodies.

Raw JSON, a compact Markdown table, screenshots, profile provenance, all build
hashes and copied harness sources stay in the explicit owned run directory.
The command does not send Desk notes or claim a win. The stream compares the
table and writes the required Japanese line after reviewing the limits.

## Harness checks

`pnpm test:harnesses` checks public-identity decoding, fail-closed outbound
guards, missing-run median behavior, the local production response policy,
scoped non-multiplexed route arguments and refusal of failed TLS/HTTP probes.
Phone checks reject missing rule witnesses, preserve dedicated-worker shaping
without the unsupported navigator override, and keep page-only CPU emulation.
These are separate from the real public-browser measurement. Chromium's
[network command split](https://chromium.googlesource.com/chromium/src.git/+/3be04b7cc3b76fae2f8b5077695aa764f659df34)
and its renderer implementation
explain why the old combined command fails on dedicated workers.
