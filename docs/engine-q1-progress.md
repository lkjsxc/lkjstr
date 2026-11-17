# Read-plan correctness and measurement

## Purpose

Record the Q1 implementation evidence without treating its unfinished coverage
and live-union work as complete. The requirements remain in [read-plan.md](read-plan.md).

## Implemented boundaries

- [Exact filter identity](engine-filter-identity.md) shares equivalent selectors
  independently of array ordering. Different ranges, limits, tags and search
  predicates remain separate, and existing owners keep their wire subscription.
- [Logical page frontiers](engine-q1-frontier.md) prevent one filter in a finite
  envelope from advancing another filter past its own newest-page quota.
- A thread's exact focus ID is omitted from relay lookups while its verified body
  is held. Its replies, counts, missing ancestors and metadata retain their own
  demands. Eviction recreates the focus lookup on the next want.
- [The native scorecard](engine-read-scorecard.md) drives actual Engine inputs,
  verification and protocol effects for 32 candidate relays, 300 authors, Home,
  Notifications and three followed profiles. Simulation is labeled explicitly.

These changes introduce no visible words, layout, protocol message or live
multi-filter grouping. The withdrawn S1 has no runtime implementation in the
inspected tree; only its withdrawal remains in the requirements.

## Controlled native evidence, 2026-11-17

The same new black-box tests ran against detached source a5011463 and the
candidate. Both used four build jobs and four test threads, with debug symbols
and incremental compilation disabled.

| Target | Baseline | Candidate |
| --- | --- | --- |
| Cached thread focus | 2 pass, 3 fail | 5 pass |
| Finite shared page frontier | 1 pass, 3 fail | 4 pass |
| Exact identity and historical evidence | 1 pass, 4 fail | 5 pass |

The frontier failure loses an actual event: the broad filter's cursor falls
from 99 to 1 after a narrow sibling contributes an older event. The unchanged
continuation fixture obtains the missing event at 90 after the repair.
The focused candidate also passed 31 core unit tests; one existing manual
workload remains ignored. These checks do not constitute a public-relay run.

The broader native suite exposed a preexisting positional assertion in
engine_wire_review_test. It also fails unchanged at a5011463: the new public
cache-policy output precedes rows. The fixture now selects the intended rows
message and preserves its original note, mute and unmute assertions. No runtime
change was made for that fixture correction.

Exact logs and before/after JSON are retained under the isolated worktree's
ignored tmp directory. Final release gates and public results must be recorded
before describing this contribution as shipped.

## Isolated scorecard result

The valid pair ran on 2026-11-17 from 02:32:56 to 02:34:14 UTC with separate
Cargo targets. Host loads (1/5/15 minutes) were 2.39/3.51/4.24 initially and
3.87/3.70/4.24 finally. The retained files are
`tmp/q1-scorecard-before-isolated.json`,
`tmp/q1-scorecard-after-isolated.json` and
`tmp/q1-scorecard-isolated-time.txt`.

The baseline is detached `a5011463`; the candidate is this worktree's
uncommitted Q1 source. Compiled manifest paths identify the baseline's
`tmp/q1-before/crates/lkjstr-core` and the candidate's `crates/lkjstr-core`.
The reports hash five runtime sources captured by `include_str!`; source-set
digests differ while the fixture fingerprint is identical. Full paths,
digests and report hashes are in [the scorecard record](engine-read-scorecard.md).

The earlier pair reused one Cargo target across both trees and returned stale
baseline behavior for the candidate. It is discarded, not mixed with the valid
results. The isolated candidate passes both raw and normalized ownership cases.

| Reordered equivalent-filter ownership | Baseline | Candidate |
| --- | ---: | ---: |
| Total REQs / logical filters | 2 / 2 | 1 / 1 |
| Added REQs when the second owner opens | 1 | 0 |
| CLOSE when one owner leaves | 1 | 0 |
| Replacement REQs when one owner leaves | 0 | 0 |
| Wires after one owner leaves | 1 | 1 |
| CLOSE when the last owner leaves | 1 | 1 |
| Wires after the last owner leaves | 0 | 0 |

The five-view aggregate is unchanged in both opening orders: recall 300/300,
31 REQs, 33 logical filters, seven connection attempts, six distinct relays,
six peak sockets, 19 peak subscriptions, 445 wire events and 144 duplicates.
Protocol bytes are 312001 incoming and 63830 outgoing; simulated verified-store
screen readiness is 270 ms. No verification rejections or drops occurred.
A floating-point ratio delta near 1.4e-17 is not a changed event/request count.

This proves an exact-selector ownership correction, not an aggregate or public
performance gain. Browser paint and recorded-week learning remain unmeasured;
the broader native workload has no claimed reduction from this change.

## Remaining Q1 work

The render snapshot and retained count contributors are not relay/filter
coverage witnesses. A broad limited Home answer also cannot establish a narrow
profile's historical completeness. Durable suppression needs verified committed
receipts, retained bodies, relay/filter scope, explicit unresolved boundaries
and invalidation after lost evidence.

Live selectors remain independently owned. A relay cannot remove only one
filter from an immutable live envelope. Sharing such an envelope requires an
explicit strategy for lifetime and handover costs; no zero-replay claim is made.
The native scorecard does not substitute for browser first paint, public-relay
measurement or recorded-week learning.

## Gate record (2026-11-17)

The isolated foundation passes `pnpm check:repo`, `pnpm test:quiet`, `pnpm rust-wasm:quiet`,
`pnpm verify:quiet`, and the frontend `pnpm check` and `pnpm build`. The native gate includes formatting,
native/WASM Clippy and the complete workspace tests. Two older wire fixtures assumed the first output
was a row; both fail unchanged on the baseline after cache-policy messages were added. They now select
the actual `feed` row output and preserve every content assertion.

The browser reservation guard found another acts proof running at 02:59 UTC. A later single mock
smoke attempt reached a profile, then failed because a second note-anchored window discarded the
structural profile header. No public comparison, primary integration or ship is claimed. Other
roots' live-union and cache work still needs a combined proof.

## Windowed structural headers (2026-11-17)

Native profile and channel projections now retain their structural header outside the currently
selected note window. Neither a deep anchor nor a zero-note window removes the navigation row;
the note range is unchanged. Top/fresh markers no longer count the pinned header as an unseen note.
The mock mirrors pinned headers on windows and updates while scrolled. This is a correctness and
first-paint smoke repair, not a Q1 scorecard or real-relay performance improvement.

Two native and two mock structural-header regressions pass. The frontend suite passes 463/463
across 86 files; check and build pass. Eighteen preexisting frontend lint findings across thirteen
files required mechanical formatting/lint corrections, each reviewed for unchanged behavior.
The full mock browser smoke passed 420/420 checks with zero failures under the shared harness lock.
It includes profile/Their Home navigation and reload at desktop/phone widths, the held cached
Home head and new-post reveal, scrolled position, and immediate own-channel-message display.
Channel messages are exempt from the initial head hold, consistent with the channel desk's
existing live-message behavior. These are mock results, not a production Worker/public-relay
first-paint or Q1 scorecard result. The combined real-Worker proof and ship are pending.
