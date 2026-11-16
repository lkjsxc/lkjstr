# Ninth public-network coverage evidence

## Purpose

Preserve the original live-hour comparison, explain the two hidden-row findings
and state where bounded instrumentation prevents a completeness conclusion.
Timing and resources are in the [performance record](engine-performance-ninth.md).

## Original source and denominator

The immutable run `tmp/r9d1` used source
`d0a4c3d7563a206ebbc471bd339bb6ead032faa9`. Public account:
`f9d4978f63e4da11b446971bd9ffc9a3b84db85d8581148a13ff7474e045d4eb`. Live interval:
2026-11-16 21:47:53.562 to 22:47:53.670 UTC. Read-only controls asked the observed
source routes over the same event-time span; native eligibility applied retained
public account/list state. Reposts were excluded from the direct kind-1 Home
denominator. Primary retained Home routes yabu.me, nos.lol and premium.primal.net
all reached control EOSE. Notification controls reached EOSE at eden.nostr.land,
nos.lol and hist.nostr.land; relay.damus.io failed. These actual-source routes
are distinct from bootstrap yabu.me, nos.lol and relay.damus.io.

The verified kind-3 follow event stayed
`4cd52a682926f8f919b418f92d0d7393939d17eac090c050d24f6949292ccdc4`
through the live audit. Its 451 distinct valid pubkeys include the account itself.
The matching Home wire query 2456 has 452 author entries but only 451 distinct
pubkeys: the account is appended twice. Its distinct set equals both the original
follow set and the direct-control filter. There is no self omission or distinct
author denominator mismatch in that comparison.

The original report records **53 eligible Home controls, 51 observed top-level
note IDs by the live cutoff, zero first observed during control grace, and two
absent IDs**. It initially classified one as a matching-query/EOSE candidate and
one as uncertain after a route ended. Both are explained below. Notifications
returned zero eligible live controls and are uninformative.

Home remained at requested anchor `top`, with Fresh 0 at cutoff. Wire seen
tracks a top-level row's `id` OR `key`, not nested references or proof that its
note ID was rendered. Cache, wire, scoped DOM and viewport/compositor paint remain
distinct. DOM membership excludes nested quotes, other tiles and grouped
constituents; timestamps are first observed membership, not insertion/paint times.

## Two actual hidden placeholders

| Original candidate ID | Created UTC | Saved keyed Home placeholders |
| --- | --- | ---: |
| `000005aa1b25d1ddc1dc1e09d2b38f295d637a20016c348b0b65662bd985e70d` | 22:25:45 | 23 samples |
| `0000080d421e98276dd6a092aaadf8320945b79b3aaaf0e18e87e9253669887e` | 22:05:59 | 43 samples |

Both matching signed payloads were physically cached and projected on Home.
Both exact IDs appear on top-level `.note` nodes as `data-key`, without
`data-note`. The frozen hidden-note branch deliberately returns that shape;
the original ID-only DOM witness therefore did not credit those placeholders.
The second ID also has a retained positive matching-payload receipt from nos.lol
at 22:05:59.958 UTC on query 2456, before its client-close. The first candidate's
recorded Home wire appearance is 22:25:46.044 UTC, after the host receipt cap;
its absent retained receipt evidence remains unknown. This refers to observed
wire appearance, not the event's authored timestamp.

A subsequent finite offline native audit verified both signed controls, decoded
both references to `Nevent`, and obtained exactly one existing Quote segment
from each. Nevertheless the unchanged noise policy classified both as
`machinePayload=true`, `machineHidden=true`, `visible=false`.
That is a confirmed quote/noise projection defect, not evidence that Home never
received or represented the rows. The event-ID prefixes imply nothing about spam.

Audit: `tmp/quote-policy-tree/tmp/quote-policy/native-audit/report.json`,
23:07:58 to 23:08:08 UTC, 9.517 s, load 1.19 / 2.92 / 4.50 to
1.40 / 2.91 / 4.48, SHA256
`cfbf9420d982ab4d278c2f54c21a92df9c5a7cb09ea573d3891a85501aeb872e`.
The audited baseline's `content.rs` hash equals the frozen run's:
`f80da30b8a4b5b92daa22e0c4ef61ef281bdba98f231dcef6827b924406e4631`.
The original 53/51 result remains preserved with this correction; later fixes
are not retroactively included in the measurement.

## Evidence budgets and unknowns

| Evidence | Last sample without drops | First limited sample |
| --- | --- | --- |
| Host delivery collector | +1,152.911 s, 22:07:06.452 UTC | +1,213.014 s, 22:08:06.556 UTC |
| Worker query evidence | +1,213.014 s, 22:08:06.556 UTC | +1,273.120 s, 22:09:06.661 UTC |

At the first host-limited sample, 96,688 receipts occupied 33,554,293 bytes of
the 33,554,432-byte budget; 4,635 receipts had already been omitted. The 100,000
record bound was not reached. The final exported collector reports 133,060
delivery omissions, no query/socket/frame omissions and no forbidden frames.
The last recorded complete host delivery evidence is at 22:07:06.452 UTC;
exhaustion is bracketed by samples, not timed exactly.

The Worker first reports three omitted queries with 4,175,811 retained filter
characters. Its independent bounds are 1,024 interned filters, 4 Mi characters
and 10,000 query records. Characters are not bytes; that sample does not identify
which Worker bound was reached. The original report subsequently falls back to
that limited Worker query evidence. Source-scoped DOM recording itself did not
saturate, but positive DOM observations cannot repair missing network negatives.
Overall live network completeness remains unknown.

## Independent historical availability and later exercise

Preselection happened before any application result, 21:47:34.259 to
21:47:42.204 UTC: ten eligible historical notifications and six verified direct
thread replies. It admitted 905,437 data-message bytes in 563 frames and
438 distinct events without exhausting the preflight budget.

The separate post-hour exercise recorded all ten selected notification IDs and
all six selected thread IDs in direct source-scoped DOM membership. Its credited
result remains unknown: notification comparison had ten independent verified
controls and 124 recorded actual-source queries, while thread attribution
retained no usable actual-source query and therefore no independent actual-route
denominator. Zero attributable queries does not prove no request was sent.

The historical phase reused the live host receipt collector, already saturated;
it had no independent receipt budget or reset. Thus the raw **16 positive DOM
observations** are useful availability evidence, while the original credited
network-and-DOM count remains zero/unknown. Cached or DOM positives do not certify
receipt completeness. These never enter the live-hour denominator.

## Outage companion

The owned sidecar began observing at 22:48:54.162 UTC, after the full live hour,
around the ten-minute cut. It retained nine independently validated receipts for
one distinct note, 6,084 bytes and 86 EOSEs, with no sidecar event drops.
Home had one eligible direct control and one scoped DOM observation; two control
routes reached EOSE and one failed. Notifications had zero eligible controls;
thread had no attributable overlapping source query.

The follow event changed after the live audit, and 1,363 Worker query records had
been omitted by companion capture. Gap completeness remains unknown. Capture at
22:59:35.203 UTC had load 6.45 / 8.30 / 6.40. This post-hour positive evidence does
not repair the saturated live-hour network record.

## Repeated count acquisition

From live +671.990 to +912.526 s, 58,756 retained delivery occurrences represent
2,547 distinct event IDs and ID/payload digests across 771 queries. Of those,
58,370 occurrences belong to the request family `[1,6,7,9735]` with `#e`.
Actual event kind is not retained in host metadata; this is a request-family
classification. The frozen source creates that family for visible-note counts.

One identical nos.lol filter returned the same 200 IDs over 17 EOSE/client-close
queries in about 91 s; another did the same. An identical premium.primal.net
filter returned the same 123 IDs across 21 queries. During the interval 1,112
queries opened and 1,115 closed, while physical cache count grew 855 and scoped
Home DOM IDs grew 27. These are repeated acquisitions, not 58,756 new notes.
Same-query identical deliveries are already deduplicated by the host collector.

The interval has 97 more retained records than the difference between sampled
collector counters; those captures are not atomic with CDP callbacks.
No accepted/rejected/validity conclusion follows from these metadata-only counts.
A bounded native plan targets routing before count-bucket normalization;
the public responses alone do not establish a particular internal cause.
Local regression evidence and later corrections must be recorded separately.

## Retained evidence

Read-only derived files in `tmp/ninth-hour-review`:

- `precap-network-analysis.json`: SHA256 `7cc109399f722a561088b54ec9fb46d190d65fc11abbe266846f9869de3055fe`.
- `scoped-followup-evidence.json`: SHA256 `72dd6ad18cf12e4e083948a49fcf2c6fe58195c7d620bbc6551ff6d9a781ea2e`.
- `candidate-placeholder-evidence.json` and
  `candidate-evidence-before-export.json` preserve the original candidate facts.
- `count-hydration-replay-plan.md` records the bounded local investigation.

Analysis made no public query, browser session or run change; original evidence remains intact.
