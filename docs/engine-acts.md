# Acts on acts

## Purpose

Implementation of [interface-acts.md](interface-acts.md), using existing words,
chips and profile context styling. The engine resolves references; the page
receives finished additive display models.

## Selection and ownership

- The final `e` tag is the only immediate target. An empty, malformed or missing
  final value does not fall back to an ancestor tag.
- At most four act-to-target edges are traversed, including the newest act.
  Missing links are requested by id under the visible view's ownership. Hiding
  or closing the view releases its contribution to those shared requests.
- Cycles, malformed ids and unsupported terminal kinds do not become excerpts.
  Public note kinds 1 and 42 use the existing renderer. Other document kinds
  require their existing separate engine and interface work.
- A notification's targeted act must belong to its account once the event is
  known. Ordinary-note notifications keep their existing mention semantics. An unresolved target stays provisional without an invented act chip.
  The ownership decision applies to rows, unread totals and read-watermark ties.
- Reactions, reposts and trusted zap notifications retain their newest type and
  immediate-target grouping. The displayed excerpt and navigation use the final
  note. Failed, missing and pending lookups reuse the existing quote states.
- An act on an act contributes only to the immediate target's counters, reaction
  chips and own-action marks. Ancestor `e` tags are still reference indexes; they
  do not increase a terminal note's action counts or repost attribution. Undoing
  a direct reaction therefore leaves a reaction to an act intact.

## Profiles

Reactions and Reposts select one original activity event per terminal note.
Representable indirect acts take precedence over direct acts, as the specified
context must survive when the person did both. Among those acts the newest
`(created_at, id)` wins. Context, row time, ordering and held anchors use that
same representative for trusted chains. Receipt validation precedes final display
selection so an untrusted link cannot suppress a valid direct act. Date bounds
apply to the act; text and media filters apply
to the final note. The row key and thread target remain the note id.

An indirect act on a zap receipt can traverse the receipt only after the existing
provider validation accepts it. The prescribed `ActRef` has no zap variant or
words for its context: the terminal note is retained without that unsupported
context. Such an act follows representable indirect acts in representative
selection, then precedes direct acts. No receipt JSON is displayed. This is the
nearest existing display under the written no-new-word rule.

Home, lists and search gain no activity rows. Profile activity retains native
scrolling: the existing time index does not describe collapsed act identities.
Late actor metadata changes only the context/header, preserving note contents.

## Bounds and contract

Resolution retains at most four events. Temporary representative maps are bounded
by the retained source slice; visible hydration retains the existing window,
120-id lookup and 6000-author limits. No long-lived act graph or timer is added.
Only the next missing link of an admitted chain is requested.

Protocol 13 adds `ActRef`, `NotificationRow.target.act`, `pendingAct`,
`NoteRow.act` and `actOn`; absent fields preserve older render behavior. The
proposal is in [engine-proposals.md](engine-proposals.md). Exact-id absence is
accepted only after every candidate request ended successfully and below its
limit, with no matching unadmitted event or queued verification. Other ended
requests produce the existing error state, not a claim that the note is absent.

## Verification

Native regression files cover bounded traversal, target ownership, terminal
counter isolation, profile selection and anchors, late metadata, missing/failing
lookups and request cleanup. The loopback Worker runner is `pnpm acts:check`,
consuming the real package already built by `pnpm engine:package`. It uses fresh
ports/data and signed synthetic events, rejects publication and authentication,
and permits only the fixture's anonymously fulfilled provider metadata request.
Its report retains artifact, fixture and source hashes and cleanup evidence.

The screenshot matrix adds the five specified scenes plus failed-notification
and repost-profile checks. `web/scripts/shots-review.ts` combines the required
1440 dark and 390 light Japanese captures into JPEG sheets with a maximum
2000-pixel long edge under `/home/coder/workspace/lkjstr-review/`. Inputs and
outputs retain hashes; assembly does not count as engine validation.

## Baseline branch evidence

Against account-safe commit `07e88178`, all four quiet gates passed, as did the
full frontend check and 21 focused native act tests. Production Worker proof
`tmp/acts-worker-20261117-b/report.json` passed 32 checks with 38 local requests,
one anonymously fulfilled provider lookup, no signing or publication attempt,
and closed browser, server, sockets and temporary profile. Production WASM:
`c933f58e6a71cfd51cbaa17dea94d20f1afa0d4c3df40692dbcdf3ced4ceb2b2`.

The corrected screenshot runner captured 84 A scenes across all twelve
width/theme/language variants and 78 K/M scenes at the two required sheet
sizes. Inputs are in `tmp/acts-shots-20261117-b/`. The launcher now waits for a
visible child instead of its hidden time marker; notification scenes close the
preset tab before installing a fresh filtered subscription. Existing external
sheets from another draft were preserved. Current-main integration, full browser
gates and final sheet assembly are recorded by the subsequent verification step.
