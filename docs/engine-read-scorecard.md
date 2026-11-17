# Native read-plan scorecard

## Purpose

Exercise the actual Engine inputs, verifier, planner and Network effects against
a deterministic fixture. This is a replayable native Q1/Q5 measurement, not a
public-relay or browser benchmark. The entry point is
`crates/lkjstr-core/examples/engine-read-scorecard.rs`. Its helper modules live
under `examples/read_scorecard/`.

## Run and compare

Run outside the ordinary gate, using identical driver files at both revisions.
Separate target directories are mandatory: never reuse one Cargo target between
baseline and candidate worktrees. Execute each command in its matching worktree,
and copy the baseline report into the candidate worktree before comparing:

```sh
CARGO_TARGET_DIR="$PWD/target/read-scorecard-baseline" CARGO_BUILD_JOBS=4 \
  cargo run --quiet -p lkjstr-core --example engine-read-scorecard \
  -- --label BASE > before.json
CARGO_TARGET_DIR="$PWD/target/read-scorecard-candidate" CARGO_BUILD_JOBS=4 \
  cargo run --quiet -p lkjstr-core --example engine-read-scorecard \
  -- --label CANDIDATE --baseline before.json --require-union > after.json
```

The example is automatically discovered by Cargo. It needs no new dependency,
package script or test registration. A baseline mismatch in schema, fixture
fingerprint or simulation contract fails instead of comparing different work.
The report gives absolute and relative metric changes; a zero or unknown
baseline does not invent a percentage. Record source revision, date and host
load alongside both commands.

For an isolated exact-equivalence failure witness:

```sh
CARGO_TARGET_DIR="$PWD/target/read-scorecard-candidate" CARGO_BUILD_JOBS=4 \
  cargo run --quiet -p lkjstr-core --example engine-read-scorecard \
  -- --witness-only --require-union
```

The JSON is printed even when the strict witness returns failure. Run it at
both revisions; a predicted failure is not a measured failure. The ordinary
command reports results without assuming an improvement.

## Build provenance

Every report includes the compiled `CARGO_MANIFEST_DIR` and SHA-256 hashes of
`network.rs`, `network_plan.rs`, `network_messages.rs`, `request_policy.rs` and
`wants.rs` under `src/engine/`. `include_str!` captures those bytes at compile
time; execution hashes those embedded snapshots, never mutable source files.
No source text is included in the JSON.

Independently check the manifest path and each hash against the intended
worktree before interpreting a comparison. The aggregate hash consumes sorted
relative path, NUL, lowercase SHA-256 hex and LF for each file. Source hashes
are provenance, separate from fixture identity: a runtime change should change
its source digest while keeping the workload fingerprint unchanged. The
comparison intentionally does not require source digests to match. These five
files do not replace a full revision/driver manifest or clean-build evidence.

## Workload and denominator

The source distribution, relay latencies, page limits and refusal pattern
extend `tests/engine_read_simulation_test.rs`: 32 candidate relays and 300
followed authors. Unlike that earlier selection-only test, this driver sends
real planner-generated frames and returns real signed fixture events. No
512-byte event estimate or route-count-as-request shortcut is used.

One deterministic note exists per author. Every thirteenth note mentions the
reader. Home, Notifications and profiles for authors 0, 100 and 250 open at
the same simulated instant. Both declared and reversed opening order run on
fresh engines. The first profile closes at 12 seconds and reopens at 13
seconds. Both runs end at 30 seconds, then close every view.

The fixture includes verified-shaped signed follow, relay-list and metadata
context in the initial Store. The 300 notes begin absent. Metadata is also
available from every fixture relay. Signed relay-list declarations retain
the original distribution's advertised coverage; actual note possession is
held separately. Neither the planner nor its weights can inspect fixture
ground truth. Fixture signing uses public test-only scalars and never exports
a key or sends an EVENT publication.

Ground-truth eligibility uses the engine's query policy over all candidate
events, separately from the measured Engine. Recall counts eligible IDs that
the measured Engine actually verified and retained, divided by eligible IDs
present anywhere in the candidate fixture. Per-want denominators are also
reported. Configuration can admit fewer candidates than supplied; both counts
are explicit.

## Metrics and limits

REQ envelopes, constituent logical filters, repeated equivalent relay/filter
pairs, Connect effects, distinct connected relays, peak sockets, peak
subscriptions and actual serialized protocol bytes are counted independently.
Incoming duplicate wire IDs include cross-relay and cross-subscription
duplicates. Cache-hit wire events are separate. EOSE, cancelled requests,
cancelled responses, rejected frames and verification drops remain visible.

A request with no new wanted event may still prove an empty count or refresh
metadata correctly. `zeroNewWantedRequests` is a literal count, not a blanket
waste verdict. Per-accepted-event ratios use obtained wanted IDs; zero obtained
IDs yields null ratios. HTTP inspection bytes, TLS and WebSocket framing are
unknown, not silently included.

`firstScreenVerifiedReadySimulatedMs` is the earliest simulated tick when the
newest ten eligible IDs per view (or that view's smaller entire result) are
verified in the Store. It does not measure rendering, pictures, layout or
navigation. `firstPaintMs` stays null. Preserve the separate real browser race
before treating this simulated guard as a release decision.

The ownership witness opens an equivalent filter with reversed author/kind
set order under a second owner. It measures added requests, removal closes,
replays and surviving wires. Its normalized-input variant is an explicit
control, not a hidden candidate policy. Strict mode requires one wire while
either owner survives and none after the last owner closes. It proves exact
equivalence only; overlapping finite pages require separate completion proof.

## Isolated result, 2026-11-17

The valid pair is `tmp/q1-scorecard-before-isolated.json` and
`tmp/q1-scorecard-after-isolated.json`. Baseline source is `a5011463`; the
candidate contains the uncommitted Q1 changes. The recorded interval is
02:32:56-02:34:14 UTC in `tmp/q1-scorecard-isolated-time.txt`. Host loads
(1/5/15 minutes) changed from 2.39/3.51/4.24 to 3.87/3.70/4.24.

The compiled manifest paths identify separate trees:
`/home/coder/workspace/lkjstr-q1-union-20261117-0208/tmp/q1-before/crates/lkjstr-core`
and `/home/coder/workspace/lkjstr-q1-union-20261117-0208/crates/lkjstr-core`.
Their recorded runtime source-set hashes are, respectively:
`a2b09a085cb2c45ec2c4b38ffda2f3b5ce8a8895e4a9d28a489cf4e5c5fd0ff1` and
`01299228bb71ddbe4b60288fb1cd609a5e59a25371b68717e3d0d0a8f778403d`.
The fixture fingerprint is identical:
`c865e976ee92df9ecdf73a7d3ed906124468625828fa7140dad8ed4a8ce23ecc`.

| Aggregate, in each opening order | Baseline | Candidate |
| --- | ---: | ---: |
| Obtained / wanted IDs | 300 / 300 | 300 / 300 |
| REQ envelopes / logical filters | 31 / 33 | 31 / 33 |
| Connection attempts / distinct relays / peak sockets | 7 / 6 / 6 | 7 / 6 / 6 |
| Peak subscriptions | 19 | 19 |
| Wire events / duplicate wire events | 445 / 144 | 445 / 144 |
| Incoming / outgoing protocol bytes | 312001 / 63830 | 312001 / 63830 |
| Verified-store screen readiness, simulated ms | 270 | 270 |

Both opening orders match; no aggregate improvement is claimed. Verification
rejections, verification drops and subscriptions after closing all views are
zero. The ratio comparison's approximately 1.4e-17 difference is floating-point
rounding, not a measured change in requests or recall.

The separate reordered-owner witness changes from two REQs to one. Adding the
second owner sends no additional REQ; removing one owner sends no CLOSE or
replacement REQ and leaves one wire. Removing the last owner closes that wire.
The normalized control already had those results before the change.

The first pair used a shared Cargo target and returned stale baseline behavior
for the candidate. Its artifact identity was not established, so that pair is
discarded. Only the isolated pair above supports these numbers. Native results
do not establish a browser, public-relay or recorded-week gain.

Report SHA-256, before then after:
`2568b538db916dd52e3a04081ff5f909d0aa8bcafd20c093f3fa2df93f656c32`
and `e419271b0adfb8d490c3ede9ea25bcf3e6425d2e6b202b2d0066b68e14dbd9e1`.

## Recorded week and public evidence

Recorded reader behavior is intentionally absent and labeled not implemented.
A later recording should include a schema identifier, account pseudonym, origin time,
monotonic event offsets, view/query fingerprints, visibility/focus transitions,
opens, dwell, scroll and actual relay outcomes. Preserve original observations,
distinguish missing fields from zero, bound its length, and clear it with the
account. Synthetic actions must never be labeled a recorded week.

The existing `engine-public-verify` example accepts `events`, `context` and
`queries` and verifies public-control eligibility. Continue using that
interface for the allowlisted sample. A public scorecard additionally needs
capture-time REQ/CLOSE frames, received frame bytes, candidate/control IDs,
query endings and browser paint marks from the same run. The native report
leaves `publicRelayMeasurement` null instead of substituting the fixture.
