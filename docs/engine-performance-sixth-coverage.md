# Sixth-hour coverage evidence

## Purpose

Separate public relay receipt, verified eligibility, cache presence, wire
projection and first observed source DOM membership for the completed
[sixth public hour](engine-performance-sixth.md). Missing membership is a
candidate requiring causal evidence, never automatic delivered-event loss.

## Scope and controls

The interval was 2026-11-16 16:25:30.595-17:25:30.767 UTC. The independently
selected and final cached kind-3 event was
`88275f6b5ef6eb16753368a99a592a0af9a6670b9a55216609a15d1dd2d52b33`.
There were 156 follows plus self. The first complete 157-author request began
at 16:25:31.743; the bootstrap requests were owner-only, then 156 authors.
Every later observed Home filter used the final set with no outside author.
The seven candidates all postdate that transition and none has its omitted
author. Unchanged endpoint follow events alone would not prove this.

Direct Home controls queried actual source relays over the same event-time
window. All reached EOSE: yabu returned 5 events, nos.lol 20, purple 0, ditto
31 and noswhere 0. Native signature/query/mute eligibility retained 31 distinct
kind-1 notes. Of these, 24 had top-level Home DOM membership first observed by
the cutoff; zero appeared during control grace and seven remained absent.
Repost wrapper membership is outside this comparison. The read-only account
cannot decrypt private mute content.

At cutoff Home was visible at `anchor:top`, `atTop:true`, 800 projected rows,
scrollTop 0 and Fresh count 0 with its control hidden. Nested excerpts, another
tile, detached nodes and wire-only packets do not count as Home DOM membership.
First observation may lag insertion; viewport visibility and compositor paint
are unmeasured. Every candidate was absent from the sampled cache and wire
projection too, with zero matching host EVENT receipt before the cutoff.

Notification controls returned no eligible kind-1 mentions/replies; grouped
reaction/repost/zap constituent completeness is unmeasured. The separate thread
had six top-level DOM notes and seven projected rows but zero eligible direct
focus-reference controls. These empty controls are uninformative, not passes.

## Exact candidates

The following full IDs identify the retained signed payloads. Times are UTC on
2026-11-16. All seven remain unresolved coverage candidates for the live hour.

| ID | Created | Direct control first observed | Route group |
| --- | --- | --- | --- |
| `d1bc762d88e55bc4312e4c4e5effd7b5b9eec223c322807478637d7e6b379c47` | 17:20:00 | nos.lol 17:25:32.296; ditto 17:25:34.629 | After retirement |
| `0000944dc822261676b890d8fbfe13334d2e4b3809f1fb1ab55f3cf8f2246a77` | 17:18:55 | nos.lol 17:25:32.296; ditto 17:25:34.631 | After retirement |
| `87655dcaafcc62cc9e811656331e5432af09ccf41e58ebbe61ac331e2638031d` | 17:24:58 | ditto 17:25:34.622 | After retirement |
| `22cec2189541e673c1a77acd04534d01a6d396b3619bc1d58ded1e746b53976e` | 17:23:48 | ditto 17:25:34.624 | After retirement |
| `8c5c6a847641c291b11d55c606c33b87e7192bec09bae5a26293beafc9305be7` | 17:21:02 | ditto 17:25:34.627 | After retirement |
| `48e98e35e69db32cdb1ccdf8a564225efeef1fa089698d9feed671cd377af637` | 16:29:51 | ditto 17:25:34.649 | Compatible active query |
| `fd18cf130aae00b0da09d9d792448f57479f43d52684fe667b035320af1bdac2` | 16:26:11 | ditto 17:25:34.649 | Compatible active query |

The five later notes followed this observed route transition:

1. Productive ditto socket 6 closed at 17:18:45.698. No raw close explanation
   or internal planner decision was recorded.
2. A recovered socket sent Home `w4481` at 17:18:48.946, with all 157 authors,
   kinds `[1,6]`, limit 200 and `since:1794849427`.
3. It returned one EVENT and EOSE at 17:18:49.168. The client closed the
   request at 17:18:49.284.
4. The remaining 201 Home requests through the live cutoff went to purple
   and noswhere, covered the same authors, and returned zero events. Noswhere
   maintained essentially continuous compatible coverage; purple repeatedly
   queried and closed its empty head. No further Home query went to ditto.

Those successors preserve author intent but may provide unproductive relay
coverage. The bounded two-primary-route policy cannot excuse the five missing
notes merely because the useful relay's request ended. A replay must establish
whether recovery, slot ownership or another explicit policy caused retirement.
The current trace does not record those internal decisions.

The two early notes had compatible active ditto requests and subsequent EOSE,
but no matching receipt. Their signed creation seconds cannot establish when
they became available on that relay. Later successor `since` values exclude
those older timestamps; delayed/backdated relay availability remains possible.

After the ten-minute outage, three candidates eventually appeared in the
later cache and Home DOM: `0000944d...` at 17:37:09.550, `22cec218...` at
17:37:09.016 and `d1bc762d...` at 17:37:31.514. Matching receipts are retained,
including separate late-after-CLOSE frames. These post-hour observations do not
repair the live-cutoff result or prove what the relay could have sent earlier.
The other four still had no matching receipt in the final host export.

## Historical plateau

| Request | Exact filter boundary | Wire evidence |
| --- | --- | --- |
| ditto `w1528`, index 722 | all 157 authors, `[1,6]`, limit 200, `until:1794631475` | 200 distinct IDs before EOSE and CLOSE |
| purple `w1601`, index 750 | same authors/kinds/limit, `until:1794616510` | zero EVENTs, then EOSE |
| noswhere `w298`, index 126 | same authors/kinds/limit, `until:1794831148` | zero EVENTs, then EOSE |

Ditto's first/last receipt was 16:26:51.798/51.804, EOSE 51.804 and client
CLOSE 52.358. Purple's successor began 16:26:56.615 and answered EOSE 56.912.
Of ditto's 200 IDs, 193 exact payload digests match bodies in the later signed
cache; all 193 match the request filter and their oldest timestamp is
1794616510. At 17:47:44 UTC the frozen native helper independently verified
all 193 signatures, with zero rejects, in `history-native-verification.json`.
The other seven bodies are unavailable in that later cache.

The public run did not record Core accepted-page counters. Wire receipts alone
cannot establish schema/filter admission, signature acceptance or verified page
fullness for all 200. The route/cursor transition corroborates the independently
reproduced historical-debt bug and its finite Worker regression; it does not
prove that the public plateau had no additional cause or quantify the unqueried
older tail. See [engine-history-route.md](engine-history-route.md).

## Evidence ownership and limits

`tmp/r61b/tmp/run/coverage-candidates/manifest.json` binds the original signed
candidates, direct controls, cutoff audit and observation. `successor-audit.json`
adds exact original/successor filters, their socket/request indices, close/EOSE
and receipt times, later-cache digests, cohort checks and per-candidate coverage
intervals. `history-receipt-audit.json` is beside that directory. All are
read-only analyses of completed artifacts; no extra public query was made.

The final host file retained 77895 distinct query/ID/digest receipts with zero
drops, but whole-run certification is unknown after deliberate page close and
reload. Its capture-time live certification was true with no evidence cap.
Per-target summary objects can advance after an earlier save; exact query and
receipt timestamps and dated source snapshots retain their distinct meanings.
A receipt after its request's close is not an accepted active response merely
because its old subscription ID remains attributable.

The post-outage companion independently observed two eligible Home controls
in DOM, but three capped Worker-query omissions and one page sampling timeout
leave gap completeness unknown. It does not repair this hour's seven misses.
No depth, duration or recovery result establishes global Nostr completeness.
