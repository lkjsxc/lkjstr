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
3000 distinct event IDs, 6000 control frames and 8 MiB admitted control-frame
bytes. Every duplicate frame consumes bytes. A single frame is limited to
512 KiB; the observed triggering frame may exceed the remaining aggregate
budget and is recorded separately from admitted bytes. Exhaustion closes all
active control sockets, retains its reason and remains unknown. Only REQ/CLOSE
are transmitted. The selected account's signed follow list and public mute
record are inputs to native eligibility.

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

## Verification and pending integration

The pure Node policy suite passed all 15 cases on 2026-11-16 at
19:45:46 UTC in 0.160 seconds, with load 2.39/1.30/1.11 before and after.
It covers aggregate bytes/IDs/frames/deadlines, primary-account preference,
three-candidate limits, explicit-account preservation, positive membership,
cache-only/group/outside-window exclusions and unknown evidence limits.
Native verification and network discovery are stubbed in this pure suite.
Its registration in the full observer preflight has not yet been exercised.

All 14 changed or added measurement modules passed `node --check`; existing
compiled documentation and line checks plus `git diff --check` passed at
19:49:06 UTC in 0.229 seconds, load 2.21/1.80/1.35 before and after.
Evidence is in `tmp/history-witness-proof/node-first.{json,log}` and
`tmp/history-witness-proof/source-first.{json,log}` in the isolated worktree.

The standalone finite proof uses owned loopback controls, a native signer that
never exports its keys, the actual verification helper and Chromium DOM
instrumentation. It has positive native text/thread witnesses and excludes own,
muted, invalid, outside-span, quote, other-tile, group and wire-only cases. It
also exercises control-socket cancellation and the exact direct-note action.
It proves measurement semantics, not a production application or public run.

Native and finite browser commands await the shared gate/build slot:

```sh
cargo build -p lkjstr-core --example engine-public-verify --example engine-fixtures
node scripts/real-hour-history-proof.mjs
```

Use four build jobs/test threads, the canonical owned Cargo cache/target and a
short owned `LKJSTR_TEST_TMPDIR`. Native helper compilation and behavior, the
finite loopback/browser proof, default gate integration and the actual real-build
historical phase remain unexecuted. No public measurement was started for this
change. The authored fixture is not evidence of production or public success.
