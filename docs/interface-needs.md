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
| Profile editing | `profile.save {as,profile}` carries name/about/picture/banner/NIP-05/website/lightning address. The user wants to edit their public profile and use an uploaded picture. |
| Person relays | `ProfileRow.relays` projects known outbox URLs. The user wants to inspect where a person's public notes can be read. |
| People lists | `open {sub,query:{source:"list",target,...}}` projects stored list members. The user wants to open a saved people list without treating it as a feed. |
| Article publishing | `publish` with `Draft.longForm` emits kind 30023. The user wants to write a long-form article; a parsed article reader is still missing. |
| Group subjects | `dm.send {as,draft:{recipients,text,subject?}}` and private snapshots support the subject field. A subject-editing surface remains deliberately unspecified. |

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
