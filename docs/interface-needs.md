# Interface needs

## Purpose

Engine capabilities and remaining interface needs for Claude's specifications.
No unrequested strings, CSS, layout or controls are implied by this list.
K1-K4, M1-M6 and D1 are implemented under [interface-specs.md](interface-specs.md).
Their required integration gates passed; exact review evidence is in
[interface-verification.md](interface-verification.md).

## Implemented specified controls

Keys now expose encrypted import/export, explicit protection, unlock/lock and
shared idle lock. Messages expose private lists/conversations, history, unread
marks, text composition, private encrypted recovery and inbox relay editing.
The contract is additive protocol 8; each addition is in
[engine-proposals.md](engine-proposals.md). Behavior and bounds are in
[keys.md](keys.md), [frontend-dm.md](frontend-dm.md), [dm-drafts.md](dm-drafts.md)
and [dm-editor-locks.md](dm-editor-locks.md).

Strict per-page unlock still needs an engine permission scope: a client-bound
vault lease and matching decrypted-cache ownership. Current lock/unlock applies
to all clients sharing the Worker; see K2's recorded difference. A UI flag alone
cannot provide the required isolation.

## Existing operations still without controls

| Capability | Contract and user need |
| --- | --- |
| Person relays | `ProfileRow.relays` projects known outbox URLs. The user wants to inspect where a person's public notes can be read. |
| People lists | `open {sub,query:{source:"list",tag:"30000:<pubkey>:<identifier>",account?,privateLists?}}` projects current signed public and authorized private members. The user wants to open a saved people list without treating it as a feed. |
| Article publishing | `publish` with `Draft.longForm` emits kind 30023. The user wants to write a long-form article; a parsed article reader is still missing. |
| Group subjects | `dm.send {as,draft:{recipients,text,subject?}}` and private snapshots support the subject field. A subject-editing surface remains deliberately unspecified. |
| Zap quote/invoice | `zap.quote {req,query:{target,amountMsat?}}` returns provider/split evidence; `zap.invoice {as,intent:{target,amountMsat,comment}}` returns `result.zapIntent` with validated unpaid invoices. The user wants to choose an amount/comment, inspect recipients and decide what to do with an invoice. No payment control or wallet call exists. |
| Trusted zappers | `zap.receipts {req,query:{target,before?,limit}}` returns bounded provider-authorized receipt rows with sender/anonymous/private distinction, recipient, exact millisatoshis, target and provenance. The user wants to inspect who zapped without treating unresolved receipts as verified amounts. `zap.close {req}` releases either finite query. |

Existing nonzero zap totals use the current plus marker for unresolved evidence.
The zero/blank zap control cannot show pending or untrusted zero amounts;
`Counts.zapState` and `Counts.zapUnverified` expose that state for Claude's design.

Stored reaction/repost actors still lack a detail-query shape. Missing bookmark
IDs lack placeholder rows; pins lack dedicated discovery/projection/editing.
These require engine work as well as the future design batch, as corrected in
[status.md](status.md).

## Background work and cancellation

Hidden private openings and replayed page visibility avoid unsolicited signer
prompts. Existing compose removal/clear/disposal own `upload.cancel {req}`;
`result.cancelled:true` confirms no pending owned effect. A remote blob already
accepted by a server is not deleted.

Measured transmitted-byte progress still needs suitable transport support.
Queueing is not evidence of transmitted bytes; no new progress wording has been
introduced. Private files, reactions and message deletion remain unspecified
and lack a complete runtime operation.

## Private list read follow-up

- `lists.retry {as}` resets private-list failures independently of Messages consent; a Retry control needs a specification.
- `query.privateLists` and `state.privateLists` support existing feeds/Mutes; named people-set navigation still needs a surface.
- `SubState.privateLists {phase,pending,failed,error?}` identifies unresolved private reads while public rows remain usable;
  current shared failure wording does not explain that distinction.
- `Account.privateLists` qualifies `unread`; unknown dependencies need treatment wherever a future badge uses that number.
- Private-list editing remains outside this read feature. Contract and bounds: [private-lists.md](private-lists.md).

## Remote signer authorization

`signer.auth {id,peer,method,url,expiresAt,account?,actionReq?}` and
`signer.auth.clear {id}` expose a verified, temporary request through
`engine.signerAuth.pending`; `cancel(id)` sends the owned cancellation.
The user needs to identify the signer and explicitly open or cancel its URL.
No URL is opened automatically. Subscribe to `pending` before starting the
action; that subscription owns the presenter lifetime. Without a presenter,
or after its last subscription closes, the client cancels as unsupported.
No current surface handles this intent, so existing actions fail promptly
instead of retaining an invisible authorization wait.
SharedWorker/direct ports and the fallback leader's own port are supported;
a fallback follower returns unsupported because its BroadcastChannel is not
private. Background relay authentication also cannot choose a page on behalf
of the user. Details and current verification status: [bunker-auth.md](bunker-auth.md).

## Finite storage observations

`storage.inspect {req}` / `storage.close {req}` and `storage {req,report}` expose
separate memory payload counts, exact event-store row counts (including cached
encrypted relay payloads) and approximate origin usage/quota, with independent ready/unsupported/failed/
timeout states and Worker-monotonic observation times. `engine.storage.inspect`
provides the finite client helper. The user needs a way to inspect these
limits without labeling payload bytes or origin estimates as physical cache
size. No inspection/clear control exists; clear remains unimplemented.
Source and verification limits are in [storage-inspection.md](storage-inspection.md).

## Account storage conflict recovery

An account action can fail `rejected` after another Worker changes the durable
account revision. Existing private editors/session keys are retained, and no
key operation is automatically retried. The user needs safe recovery without
losing unsaved editors; the current engine requires an explicit reload and
has no cross-Worker editor quorum or automatic credential reconciliation.

## Account loading availability

Protocol 13 adds `Ready.accountError` and `Engine.accountState` without clearing
retained accounts. Existing feeds show the existing `error.internal` line in
`.fstate`, ahead of Sign in or nonempty/end branches, while keeping rendered rows.
Automatic availability in Accounts/topbar and safe recovery from blocked or
failed loading still have no specified surface. No automatic alert, toast,
new control or popup is added; an attempted action keeps its existing failure.
The user needs to distinguish unavailable account storage from a loaded empty
account set and recover without discarding unsaved editors or retained keys.

## Live Orchestration

Reuse the existing `stats` request. The additive fields are optional for hosts
using an earlier engine. A present empty array has no current entries. The
engine retains telemetry for the current Worker session only.

- `views` contains up to 128 active public engine views, including hidden views.
  `subId` is a session-local diagnostic label. `rowCount` and `freshCount` describe
  the last core projection and exclude interface headers. `windowKind` is
  `top`, `key`, `at` or `month`. `anchorAtMs` is the absolute pivot or UTC
  month start. `olderCoverage` and `newerCoverage` are present for absolute
  windows and reuse the coverage states in `timeWindow`.
- `worker` has cumulative verification counters, current queue lengths and
  ingress bytes, last and peak tick durations, the verification slice limit,
  retained regular and replaceable counts, and the in-memory event payload cap.
  The cap measures retained event payloads. Index and Worker overhead are separate.
- Relay rows add `cooldownRemainingMs` (zero without a cooldown) and `isPrivateHost`.
  Stats strips relay URL userinfo, queries and fragments, and classifies free-form
  relay errors. Use `isPrivateHost` to hide relay row hostnames on stage.
- `bandwidthHistory` contains the latest 60 aligned one-second buckets, with
  Unix millisecond starts in ascending order and zeros for idle seconds.
  Ingress counts relay text bytes and parsed EVENT frames. Egress counts
  successful relay text sends and REQ envelopes. Duplicates and verified events
  are counted when the engine drops a copy or verifies an event from a relay.
- `orchestrationEvents` keeps the last 32 observations in arrival order.
  `kind` is `hedge`, `coalesce`, `cooldown`, `fallback`, `evict` or
  `publish_ok`. Timestamps use Unix milliseconds. Public labels use relay
  origins. Private and known auth-required origins use `private-relay`.
  `summary` is a fixed diagnostic. Use `kind` for localized interface copy.

Sampled global counters include relay transport activity. View and decision
details omit private message metadata. The mock supplies a bounded repeatable
traffic sample and representative decision kinds for interface development.
