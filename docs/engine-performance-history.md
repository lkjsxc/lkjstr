# Informative historical measurement witnesses

## Purpose

Select bounded, independently available notification and thread examples before
opening the application, then measure their source DOM membership after the
live-hour cutoff. Historical availability and historical witnesses have separate
reports. Neither changes the live-hour time span or completeness denominator.
This is measurement code, with no product control, text, layout or protocol change.

## Selection and bounds

A full `real:hour` run defaults to `--historical=on`; short validation keeps it
off unless requested. `--historical=off` retains the previous sampling path.
Selection starts with the existing verified public follow-list choice. It keeps
that account if informative, otherwise inspects at most three independently
returned account candidates. An explicit `--account` is never replaced.
No browser or application result exists while selection runs.

The preflight has a single 90-second deadline, at most three relay endpoints,
three possible thread foci per account, 100 events per requested text filter,
3000 distinct event IDs, 6000 delivered data messages and 8 MiB admitted
data-message bytes. Every duplicate, malformed JSON body and Nostr control
message consumes bytes before string conversion or JSON parsing. A single
data message is limited to 512 KiB; an observed message that exceeds the
remaining aggregate budget is recorded separately from admitted bytes. Exhaustion closes all
active control sockets, retains its reason and remains unknown. Only REQ/CLOSE
are transmitted. The selected account's signed follow list and public mute
record are inputs to native eligibility.

The installed WebSocket receiver checks compressed/uncompressed message size
through `maxPayload` before delivering the body to the harness. This bounds
String/JSON input, not every temporary transport or decompression allocation.
The retained `receivedFrames`/`admittedFrames` names count delivered data
messages, not wire fragments. Their byte counters exclude TCP/TLS headers and
WebSocket ping/pong traffic. A message rejected by the receiver before delivery
is not included in those byte counters; its limit failure remains explicit.

The historical interval is the seven days ending one second before preflight
starts. Kind-1 text notifications need three native-eligible events. Candidate
thread foci come from native-eligible Home events, ranked using native reply
relationships, with at most three examined. A thread needs two native direct
replies to its selected focus. A quote, own notification, muted event, invalid
signature or outside-interval note cannot satisfy that threshold. The exact
selected IDs are fixed before the browser starts; later rendering results never
cause account or focus replacement.

`engine-public-verify` optionally returns protocol-derived parent/root
relationships and Core query order. These measurement-only outputs do not add
an engine message or duplicate product filtering in JavaScript. The helper must
be rebuilt and frozen with the measured source; an older helper lacking the
requested metadata is rejected.
The helper separately reports `controlVerified`: an ID is included only when
its independent control body verifies, with conflicting valid/invalid duplicate
controls excluded conservatively. A verified cached body cannot lend signature
credit to an altered control with the same ID. Historical selection and
comparison require this evidence; absent metadata remains unknown.

## Post-hour phase

After the live control comparison is saved, each historical source has at most
eight ordinary page actions and a 120-second comparison budget. Individual
browser/RPC calls have a five-second deadline; queued scroll/click actions check
that expiry inside the page before acting. Cleanup has a separate five-second
budget and records failure rather than silently claiming restoration.
The selected focus must be reached as a direct top-level Home note and opened
through its existing id-based header/time action. A quote or another tile cannot
supply that action. Failure to reach it is unknown; there is no fallback focus.
The existing source observer keeps its single account/focus scope.

Independent controls use at most three actual source-query relays and the same
fixed historical interval. Their signed bodies, per-relay receipt times, EOSE,
refusal and deadline outcomes are retained. Wider configured relays are not
silently substituted. Comparison uses the current public cache and native
query/mute eligibility, and records any changed eligibility separately.

Only connected direct `.list > .note[data-note]` elements in the uniquely
attributed source view count. The first sampled membership time is distinct
from relay receipt, signature-verified cache content, wire projection and
viewport/compositor paint. A selected absent note is inside an exercised range
only when independently ordered surrounding notes bracket it in a recorded
window; unvisited boundaries remain unknown. A physical-cache ID or a wire-only
packet never counts as DOM success.

Prior cached notes with real source DOM membership are reported separately from
network receipt plus DOM membership during the phase. Absence from physical
IndexedDB does not prove absence from the Worker memory cache. Grouped reaction/repost/zap constituents
are outside this text-note denominator. Thread descendants without the focus
reference and other source scopes remain outside the comparison. Zero eligible
controls, evidence limits, unanswered routes and inability to mount the focus
are uninformative or unknown, never a completeness pass.

Post-hour scrolling returns owned views to the top before the existing fault
phases. That restoration occurs after the historical cutoff and cannot change
its result or the already-saved live-hour observations.

## Artifacts and APIs

`preflightHistorical` returns the selected read-only account and a report.
`historical-preflight.json` retains all bounded signed control responses and
native selection evidence. Only its small selection/budget summary remains in
the main report during the timed hour. `runHistoricalWitness` writes separate
`historical-notifications-controls.json` and `historical-thread-controls.json`
and returns the exercised windows, native decisions and per-ID comparisons.
The main report places them under `scenarios.historical`.

All imported measurement sources and both native helpers must be frozen before
launch, as required by the hour harness. Source hashes and helper hashes are
part of the run manifest; a later build must not replace them beneath a run.

## Verification and integration

The pure Node policy suite passed all 15 cases on 2026-11-16 at
19:45:46 UTC in 0.160 seconds, with load 2.39/1.30/1.11 before and after.
It covers aggregate bytes/IDs/frames/deadlines, primary-account preference,
three-candidate limits, explicit-account preservation, positive membership,
cache-only/group/outside-window exclusions and unknown evidence limits.
Native verification and network discovery are stubbed in this pure suite.
This initial run preceded full observer-preflight integration.

All 14 changed or added measurement modules passed `node --check`; existing
compiled documentation and line checks plus `git diff --check` passed at
19:49:06 UTC in 0.229 seconds, load 2.21/1.80/1.35 before and after.
Evidence is in `tmp/history-witness-proof/node-first.{json,log}` and
`tmp/history-witness-proof/source-first.{json,log}` in the isolated worktree.

A receive/evidence audit found the shared-ID cache-credit defect above. Three
new pure assertions failed against the prior comparator/selection at 20:03:47 UTC
(15 controls passed), then all 18 passed at 20:04:38 UTC in 0.166 seconds, load
2.21/2.40/2.61 before and after. These tests supply synthetic native decisions;
they prove JavaScript evidence handling; the native correction was verified later.
Logs are `tmp/history-witness-proof/control-body-{before,after}.{json,log}`.
The authored native/finite fixture now also checks an invalid control against a
valid cached body with the same ID; that case passed in the finite proof below.

The standalone finite proof uses owned loopback controls, a native signer that
never exports its keys, the actual verification helper and Chromium DOM
instrumentation. It has positive native text/thread witnesses and excludes own,
muted, invalid, outside-span, quote, other-tile, group and wire-only cases. It
also exercises control-socket cancellation and the exact direct-note action.
It proves measurement semantics, not a production application or public run.

Device source `6ba4b526` built both helpers at 20:13:59 UTC in 1.540 seconds,
load 1.45 / 1.64 / 2.11, with four jobs/test threads and refreshed source mtimes.
The helper copies are frozen in `tmp/device-native/623bb3549df59769e34f`.
Their SHA-256 hashes are:

```text
engine-fixtures: 1fd9b73195250ad6d9fdea17fb83486f557f94c4ed82095d8c88e3d2c5f4bad2
engine-public-verify: dafe16a9e55d95f650daa4a4370a616200fc6be4b3a60cdf47e2be762cf59ad5
```

The integrated 18 Node cases passed at 20:15:03 UTC in 0.232 seconds, load
1.80 / 1.74 / 2.11. The finite `node scripts/real-hour-history-proof.mjs` passed
11/11 named checks at 20:18:04 UTC in 0.652 seconds, load 5.38 / 2.71 / 2.37.
It used those exact helpers, including the real control/cache collision case,
and recorded zero external requests, forbidden frames or page errors. Browser,
server, sockets, profile and temporary-data cleanup completed. Exact evidence:
`tmp/historical-witness-proof-s8XWz0/report.json` and tmp/device-gates.json.

The full observer preflight and all required merged gates pass on source
cada84e17335. Fresh helper and 11-check browser proof are bound in
[engine-device-verification.md](engine-device-verification.md). The actual
real-build historical public phase remains unexecuted. Finite instrumentation
proof does not establish a production application or public-network result.
