# Read-plan scorecard

## Purpose

Q5 measures actual requests and returned events, with Q1's unchanged-product
baseline retained. It does not estimate a score by selecting hypothetical relay
arrays. The original read simulation remains a separate selector regression.

## Commands

Build the native fixture with four jobs in the shared build reservation, then:

~~~sh
cargo build -p lkjstr-core --example engine-read-score
node scripts/read-score-native.mjs --output=tmp/native-score.json
pnpm read:score --build=dist --verify-helper=PATH --seconds=300
node scripts/read-score-assess.mjs tmp/public-baseline
pnpm read:compare before/scorecard.json after/scorecard.json --change=COMMIT
pnpm read:compare --attempts=tmp/attempts.json
node --test scripts/read-score-test.mjs
~~~

All browser commands are opt-in and sequential. The public command never builds
product code. Its supplied real build is copied and every asset hash retained.
Use --engine-revision to record its independently verified source receipt.
The helper binary and harness sources are copied or hashed independently.
Native runs also hash actual product source bytes, including uncommitted modules,
separately from examples and measurement code. See [read-score-baseline.md](read-score-baseline.md).

## Deterministic fixture

The fixture has 32 relays, 300 followed authors, signed metadata and relay lists,
300 notes and 30 reactions to the reader's held note. Forty notes and metadata
are initially held. Home, Notifications and three followed profiles are open.

Actual Engine inputs produce Connect, Send and Disconnect effects. A deterministic
relay implementation matches each emitted filter, applies its limit and latency,
then returns signed EVENT and EOSE frames through the normal network parser,
signature verification queue, store and Engine row outputs. Cancelling a request
cancels its pending replies. Every wire frame is counted before product dedup.

The first-screen guard is the complete first 50 Home rows; the other views require
their first eligible row. Times use the simulated relay clock. They are not browser
paint, real network latency or WASM performance measurements.

Seven additional daily sessions replay a recorded deterministic action trace:
focus, reading, hide/show, close and reopen. Actual relay-quality checkpoints
survive each restart. The baseline has no persisted reader-learning model;
this is explicitly a generated trace, not an invented record of human use.
All fixture events, initial-store membership, wants and trace are hashed.
The whole fixture universe establishes exact recall, including held events.
A further warm-store restart restores obtained signed bodies and relay quality.
When nothing new is wanted, absolute costs remain reported and ratios are null.

## Public sample

The default public account is the same busy read-only account as the opening
race. It needs at least 100 verified follows. No owner profile or secret is used.
A blank setup browser seeds only the public identity and closes before the timed
browser opens. Initial event membership is empty.

Five visible panes contain Home, Notifications and three followed profiles.
All five native source wants and their row windows are observed before measuring
completion. Profile state uses the real main workspace persistence namespace.
The fixed workload retains their identities, relay allowlist, duration and a
24-hour control span ending before navigation. A native helper verifies control
signatures and applies the actual engine's view eligibility policy. Up to fifty
eligible witnesses per view form the union denominator.

Controls are finite and capped. Public recall means recall of these signed
witnesses, never recall of every event on the Internet. Failed/refused controls,
EOSE, rate limits and bounds remain in workload.json. Other returned eligible
events contribute useful-new traffic, separately from the witness denominator.
An event counts obtained only after valid signature and physical product-store
membership checks. Metadata cannot lend validity to an invalid event body.

Use --candidate-scope=FILE for a recorded candidate URL allowlist, independently
assembled from the same account's observed routes and verified signed hints.
The guard rejects outside candidates before constructing sockets, including in
workers, and reports denials as unknown scope. The three control relays are
witness sources, not the whole app candidate set. An unfrozen run is diagnostic
and cannot pass comparison.

Use --replay=PATH to reuse the baseline workload and exact witness denominator.
This freezes comparison identities; it cannot freeze external relay availability
or the continuing traffic of ordinary live queries. Dates and host load must be
read with every public comparison. A 300-second sample is not an hour.
A public comparison whose capture starts differ by more than the sum of their
measurement durations (at least ten minutes) is explicitly incomparable, even
when both recordings have the same witness hash: old witnesses can fall out of
live relay top-200 pages. This is a conservative window guard, not proof that
two closer runs share unchanged relay state. Native signed-data replay remains
the causal before/after guard; long-separated public samples are diagnostic.

The optional --host-route=archserver uses the existing owned, TLS-preserving
origin route. Exact original URLs, certificates and bytes remain; the report
names the route. The release itself is served with production response headers
on loopback, so no live WAN/TLS transport victory is implied.

## Metrics and bounds

Every application WebSocket frame contributes bytes before parsing. Every EVENT
frame counts before dedup, including repeats under the same subscription.
Duplicate identities digest native event fields in fixed order; JSON object key
order cannot hide duplicate events. Held events, unwanted
events and bodies that fail native verification are separate categories.
The helper rejects conflicting valid/invalid bodies sharing an ID conservatively.
Useful-new means native semantic query eligibility, not proof that every returned
event was visible. Bounded witness recall and rendered completion stay separate.

Requests, connections, exact duplicates and payload bytes are normalized by
distinct verified wanted-new events. Zero denominators are unavailable.
A wasted request is an EOSE-completed request with no wanted-new event; support
discovery may therefore appear here. Pending work is reported separately.
These labels describe evidence, not proof that every zero-yield request was
avoidable when it was sent.

The observer retains at most 128 active sockets, 20000 requests, 20000 event
bodies, 32 MiB of event bodies and 200000 delivery identities. Any overflow or
unknown target/frame attribution makes traffic evidence incomplete. Public
event bodies stay in the owned run directory. No private bodies are collected.
A bounded delivery ledger retains frame times, identities and bytes, and at most
4096 socket lifetimes. The first public baseline predates this extra ledger; its
request/EOSE/CLOSE timestamps support only the narrower offline audit.

First-screen and all-visible completion require names and decoded avatar pictures
in the observed viewports. Missing pictures or marks remain unavailable.
The opening observer uses two animation-frame opportunities; these are DOM/frame
witnesses, not compositor presentation timestamps.

## Comparison and stop rule

Comparison requires equal workload, witness and initial-store hashes and mode,
and a frozen identical public candidate scope. Assessment writes a derived file
without rewriting the raw capture; any corrected metric names its derivation.
Recall and first-screen time must not regress. Requests, connections, duplicates
and bytes per wanted-new event must not regress, and at least one metric must
improve. Missing comparable evidence never becomes a keep decision.

Native comparisons also require the same recorded action trace and all eight replay
results: one fully held warm restart and seven daily sessions. Each must retain
recall, first-screen and all-visible completion while requests, connections,
duplicate wire events and total bytes do not rise. Fixed-workload absolute
counts apply to the warm restart because it has zero wanted-new events; its
per-new-event ratios are correctly unavailable. A warm win cannot excuse a
cold loss, nor a daily regression; this makes the persisted-history evidence
part of the actual keep and stop decisions. The public comparison stays
limited to its measured real-relay workload and explicit witness bounds.

The three-attempt stop rule uses consecutive comparable candidate changes, even
when a change was rejected. Stop only when none moves any scorecard number by
at least two percent. Keep every attempted report and state the limiting factor;
do not manufacture three identical baseline runs as three implementation changes.
The attempts file is an array of changeId, before and after paths. Each of the
last three entries needs a distinct changeId and changed product source/build
hash; repeated baseline artifacts cannot satisfy the stop rule.

## Rotation

pnpm real:hour runs its ordinary public hour and faults, then the public scorecard,
then the full nostter opening matrix. The score and race reuse the hour's frozen
product and helper bytes. Optional --score-replay and --score-candidate-scope
arguments freeze the public score; the default unfrozen score is diagnostic.
Each process exits and cleans up before the
next opens a browser. Missing race marks remain failures of measurement, never
performance victories. This rotation is outside default release gates.

Related long-duration probes: [race-open.md](race-open.md),
[cache-repeat.md](cache-repeat.md), and [cache-repeat-private.md](cache-repeat-private.md).
They remain separate measurements; the five-minute baseline does not establish
a full opening matrix, two-hour repeat-cache result or phone performance.

## Q1 accepted public pair

The [2026-11-17 public score](q1-public-score-20261117.md) records 100/100 signed witnesses and a Q5 keep decision.
