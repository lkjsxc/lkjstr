# Public measurement evidence

## Purpose

Retain exact public relay request and receipt evidence outside the measured
page and Worker. This is opt-in harness instrumentation, not product behavior.
It changes no release asset, protocol message, layout, CSS or visible word.

## Why the observer changed

The [third-landing hour](engine-performance-third.md) reached the existing
4 Mi-character filter budget with 2492 retained requests and four omitted
records. A later-visible Home candidate had no per-EVENT receipt timestamp.
Matching filters and EOSE alone cannot distinguish delayed relay backfill from
an engine omission. The completed hour remains qualified; new instrumentation
does not retroactively prove its missing evidence.

`real-hour-network.mjs` consumes CDP WebSocket events in the host Node process.
Each connection and REQ has a unique lifetime. The collector records exact
filters, EOSE/close times and received event IDs with SHA-256 over all seven
event fields. It discards bodies after hashing. Independent controls still
verify signatures and eligibility natively; a matching digest proves the same
payload reached Chromium, not that the engine accepted or rendered it. Missing
Home, notification and thread candidates reference the bounded network-evidence
file by query index; reports do not duplicate large author filters per receipt.

## Bounds and unknown states

- At most 128 tracked targets, 128 active sockets, and 128 active requests per
  socket; at most 10000 lifetime requests and 64 MiB retained filter JSON.
- At most 100000 distinct query/ID/digest deliveries and 32 MiB of serialized
  delivery metadata plus identity strings. These byte limits exclude JavaScript
  object/index overhead, transient decoded frames, CDP buffers and process RSS.
- Frame payloads above 2 Mi characters, malformed data, missing attribution,
  forbidden outgoing frames or any evidence cap make completeness unknown.
- A dropped replacement REQ retires its preceding source attribution. It cannot
  attach a later EVENT to an obsolete Home request. Ordinary CLOSE retains the
  old lifetime for separately identifiable late frames.
- Browser monotonic timestamps are calibrated by the same socket's handshake
  wall time. Without that calibration, receipt time is explicitly host-observed.
  A late host timestamp may include observer delay.
- Every relevant target needs a successful probe sample, including explicit
  zero traffic. Missing/failed samples and an observed same-session probe reset
  make lifetime certification unknown. Cumulative probe counts are sampled
  lower bounds, not proof of every frame in an unsampled lifetime tail.
- Host capture can replace only lost query evidence. Lost UI IDs, view/source
  mappings, missing probes and empty control populations stay unknown.
- Audit query snapshots retain their selected source and capture-time status;
  later sampling cannot relabel a host snapshot as a Worker-probe snapshot.

The in-Worker evidence budgets are unchanged. Public runs still allow
only REQ/CLOSE, use a fresh read-only account and block service workers. Report
write failure still reaches owned browser/server/profile cleanup.

## Worker startup boundary

A minimal SharedWorker fixture exposed a competing CDP-client resume before
raw-CDP injection. Playwright resumes a target before detaching its unsupported
SharedWorker session. A guard-installed flag observed afterward cannot certify
its constructor-time boundary. Earlier public measurements retain this
qualification in their [third-hour record](engine-performance-third.md).
The corrected harness installs a same-origin module bootstrap before loading
an original Worker or SharedWorker script. It waits for successful host Network
initialization, retains an explicit boundary marker, then dynamically imports
the original unchanged URL. SharedWorker URL/name remain stable across tabs;
at most 128 early connect/message events are queued and replayed. Overflow,
missing guard or a 10-second withheld host release closes the owned worker.
Classic, blob and cross-origin worker constructors are rejected explicitly by
this measured environment. These are harness restrictions, not product limits.
The additional bootstrap fetch/import contributes to measured startup time.

## Reproduction and focused checks

Run `node --test scripts/real-hour-test.mjs scripts/real-hour-network-test.mjs
scripts/real-hour-owned-test.mjs` for the observer and ownership cases. The optional real Chromium transport check is
`node scripts/real-hour-network-proof.mjs`; it uses loopback-only fixture frames,
not a signed production event or a public relay. These checks stay outside the
hour-long default workload.

At 2026-11-16 13:31:18 UTC, load 2.56/1.89/1.89, replaying all 2492 recorded
hour requests plus eight valid synthetic continuation requests made the old
Worker probe omit all eight continuations. The host collector retained all
2500 requests (10576228 filter JSON bytes), with no dropped evidence, while all
5000 REQ/CLOSE frames still forwarded. This is an exact-payload replay with eight
explicit synthetic extensions, not another public hour. The replay preceded
the additional target-counter crosschecks; its result concerns query retention.
Raw evidence: `tmp/host-query-replay.json` in the integration worktree.

Three focused failure cases reproduced obsolete-source attribution after a
capped replacement, an unsampled detached target being certified, and a
same-session counter reset hiding uncertainty. A fourth
case proves that post-hoc counters alone cannot certify original script startup.
All 20 observer/ownership cases pass and are registered in engine-check.sh.

The final Chromium proof passed eight grouped checks at 13:58:58.196 UTC in
0.451 s, load 1.60/2.10/2.65 before and after. Both module target types carried
verified boundaries before original script/first socket execution; a second
page reused the same SharedWorker. Six outbound frames were REQ/CLOSE only,
with no public request, retained body or guard error; original module bytes
were unchanged. Artifact: `tmp/host-network-proof-vUyVlB/report.json` in the
integration worktree. Browser/server/profile cleanup completed.

The withheld-release negative began 13:55:36.580 UTC, load 1.53/2.54/2.90,
and failed closed after 10.384 s, final load 1.44/2.49/2.88, with zero relay
frames and completed cleanup. Its report is in the private-list worktree at
`tmp/host-network-proof-gYZenc/report.json`; the original startup timeline is
`tmp/host-network-proof-Jh1Pfz/report.json`. No claim about an unrun second public
hour is implied.

## Capture-time metadata correction (2026-11-16)

The frozen sixth run exposed a report alias: summary completeness was captured
by value, but its target objects kept changing with later traffic and probe
epochs. Full snapshots also shared query/delivery arrays; selected event
witnesses shared their request metadata. A later JSON save could therefore
combine a capture-time verdict with counters or route endings from the future.
The sixth artifacts retain this limitation; their original dated snapshots
remain evidence and this correction does not repair them retroactively.

Collector summaries now copy targets and bounds. Query snapshots and complete
evidence exports copy their bounded metadata; per-event witnesses copy each
matched request once per call, even when several payload digests share it.
Returned records cannot mutate the live collector. The CDP query capture uses
that existing copy without duplicating it again. No body is retained, no budget
is raised, and no public request or page/Worker instrumentation is added.
Copies can temporarily coexist with the collector and are not included in its
retained-byte counters; the caller owns their lifetime.

Three added Node cases fail as assertions against the previous collector, with
nine network controls passing. The correction passes all 27 observer/network/
ownership cases, including the three new cases. Before ran at 17:48:47 UTC in
0.071 seconds, load 4.77/4.36/3.99; after at 17:49:27 UTC in 0.105 seconds,
load 3.70/4.16/3.94. Source hashes, logs and original collector are retained in
the variants worktree at `tmp/evidence-snapshot-proof/`. No Cargo, browser or
public network was used for this proof.
