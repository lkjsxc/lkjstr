# Private-message interface

## Purpose

Implementation seams and verification for [interface-dm.md](interface-dm.md).
The engine contract and its retention limits are in [dm.md](dm.md).
The prescribed words remain in the existing bilingual string tables.

## Seams

| File under `web/src/` | Responsibility |
| --- | --- |
| `views/messages.ts`, `dm-find.ts` | Conversation rows and names-only filtering; public directory suggestions. |
| `views/message.ts`, `dm-head.ts` | Conversation lifetime, people, reading anchor and Seen acknowledgements. |
| `views/dm-stream.ts`, `dm-window.ts` | Merge engine-ordered pages; retain bounded models and mount 100 rows. |
| `views/dm-message-row.ts` | Private note treatment, inline links, reply excerpts, subjects and folding. |
| `views/dm-compose.ts`, `dm-compose-edit.ts`, `dm-outbox.ts` | Private input, deliberate sending and retained failures. |
| `views/dm-draft-store.ts`, `dm-draft-archive.ts` | Serialized encrypted writes, revision tokens and guarded lost-ack recovery. |
| `views/dm-draft-lease.ts`, `dm-draft-pool.ts` | Acknowledged writer leases and retained authorized editor lifetimes. |
| `views/dm-draft-send.ts` | Owned sends retain terminal delivery state through a refused-view unmount. |
| `views/dm-surface.ts`, `dm-subscription.ts` | Account/consent gates and tab/page visibility. |
| `engine/client-dm-access.ts`, `client-dm-flush.ts` | External crypto consent, deadlines and before-lock flushing. |
| `engine/dm-watch.ts`, `ui/topbar.ts` | The count-only frame watch and prescribed account mark. |
| `views/settings-dm.ts` | Inbox relay edits, explicit publication and removal Undo. |

## Private state

Private snapshots bypass the ordinary public row cache. Tabs persist only public
participants and an opaque message anchor. Private text is absent from tab search,
public drafts, toasts and browser preference storage. The consent preference stores
one boolean under the public account key.

Each client admits at most 32 private subscriptions. The list draws at most 200
conversations. Each conversation retains at most 8,000 message models and 2,048
public author models, while the message window mounts at most 100 rows. Account
revocation disposes the private view, its subscriptions and its retained models.

The frame opens a separate `unreadOnly` query and receives no message bodies or
conversation previews. It stops for a hidden page, a disabled setting, a locked
account or unapproved/refused external access.

## Drafts and delivery

The encrypted archive must load successfully before editing is enabled. Its editor
and every retained row must match the tab's canonical participant set, including the
owner. A mismatched record, a failed load or a missing revision leaves the archive
untouched and offers the existing Retry control. This prevents an opaque tab key
reused for different people from retargeting retained private text.

Edits coalesce for 180 milliseconds. One writer serializes saves and carries the
latest acknowledged `dmDraftRevision` as `expected`. An older save acknowledgement
cannot replace newer input. A stale rejection retains the local input without
adopting the conflicting archive revision. Sending first archives the pending row;
restored rows never send automatically.

At most 32 retained rows are accepted. The engine also enforces the archive's byte
and per-account tab bounds. Editing a failed row follows the channel rule: the
existing confirmation preserves the current input as another retained row before
putting the chosen text in the field.

Every editor registers a unique lease before becoming writable. A lock holds all
registered pages immediately, then prepares their serialized writes one page at a
time under one 15-second deadline. Preparation waits for owned sends, the latest
archive commit and the acknowledged clean metadata. A failure leaves the account
unlocked and retains its input. The hold remains until the Worker releases it;
authoritative locked Accounts arrives before a successful release.

Reconnect suspends editing immediately. Re-registration uses the same lease and its
current unsaved state before editing resumes. Unexpectedly expired writers remain
unresolved at the engine until that happens. A lost save acknowledgement refreshes
its token only if the durable state equals the last attempted or confirmed state;
a different writer's state remains untouched. An explicit disposal unregisters only
after its final flush, while actual account revocation purges the private pool.

Signer refusal hides the view while retaining the account's unsaved input and owned
send. Retry reattaches that store. A send settling while hidden still records its
actual partial or failed result, and is never resent automatically.

A pending row is removed only when a successful action and its snapshot message are
both known. A partial failure remains after the sender's own wrapper arrives.
Participant delivery counts come only from `dmDelivery`; relay counts never stand
in for people. Unsupported signers have no Retry action.

## Signer and reading lifetimes

External access is opt-in before a private subscription opens. Crypto calls are
serialized per account, with at most 16 queued calls overall. One refusal closes
private subscriptions and drains subsequent requests without another signer call.
Each external call has a 60-second deadline. Retry releases the abandoned queue;
late replies cannot post plaintext or restore a prior refusal. An already opened
extension dialog cannot be dismissed by the page.

Initial hidden visibility is atomic from protocol 7. Older engines are opened only
when the tab is visible. More requests are not sent from hidden views. A short inbox
requests additional history once per observed progress, so unchanged snapshots do
not cause a request loop.

Seen acknowledgements update only models present when the request began. Bars
already drawn remain for the current visit; returning to the tab uses the updated
models, including retained history pages. Newer arrivals remain unread.

## Compatibility and verification

Views require protocol 6. Participant queries, encrypted archive recovery and the
body-free frame watch require protocol 8. Older engines use their supplied existing
conversation keys; the interface never hashes a room. Their private editor remains
in memory and does not promise encrypted recovery after a reload.

The written shortcut is Alt+Shift+M. The existing `go('M')` helper represents a
G-then-M sequence, so the implementation follows the explicit chord instead.

The merged frontend gate passed on 2026-11-16 at 09:43:44 UTC in 5.678 seconds,
with host load 4.56 / 3.91 / 4.50. Focused tests cover recipient/load rejection,
revision retention, late revocation, before-lock deadlines, consent/refusal/timeout,
hidden history, Seen caches, UTF-8 limits, retained editing and explicit inbox edits.

The initial 23-state desktop review is under `tmp/screens-dm-20261116`.
The corrected inbox settings and narrow conversations are under
`tmp/screens-dm-20261116-fixed`: four desktop and six narrow captures passed.
The initial settings pictures showed the wrong scroll position and are not evidence
for M4. The corrected edited-relay, narrow reply and group pictures were inspected.
The complete matrix under `tmp/screens-interface-20261116-matrix` passed: 888
captures in 606.188 seconds, including all 39 K/M states in 12 variants. Its desktop
and phone review sheets cover both languages and themes.

`node web/scripts/smoke-dm-only.mjs` checks the real built UI with fresh loopback
accounts, inbox publication, wrapped delivery, archive restoration and a two-page
lock with an unsaved write. It blocks public HTTP and reaps its browser and servers.
The final real UI run passed all 16 checks on 2026-11-16 at 10:57:49 UTC in
11.561 seconds, with load 6.33 / 3.44 / 3.65 and no page errors. Its immutable
[report](../tmp/dm-ui-real-final/dm-ui-real-report.json), logs and timing are under
`tmp/dm-ui-real-final`. The additional check keeps a proven missing inbox settled
across several scheduler rotations; the meaningful frozen-package failure remains
in [the earlier report](../tmp/dm-inbox-stability-before/dm-ui-real-report.json).

The final candidate combines the production Worker with the current transport.
Its WASM SHA-256 is
`569eab166f7434ccdb545170209d6152c70337d57c3969ee4ad0a45d49eb931f`;
the transport SHA-256 is
`283d108b17ae7e78b952bbf35f55f215e36569d76e2fb8523608a86d75f44593`.
[Candidate hashes](../tmp/dm-ui-real-final/candidate-hashes.json) record all five
inputs; [built asset hashes](../tmp/dm-ui-real-final/dist-hashes.json) identify
every file served by this run. The run built only the frontend from that candidate.

The first UI run exposed a missing setup row when the account field was absent
but the private query proved no inbox; its before/after proof is under
`tmp/dm-ui-inbox-before` and `tmp/dm-ui-inbox-after.log`. The existing setup control
now follows that engine proof through transient loading states.

Final shared engine and transport gates still belong in the verification record
before the specification items are marked built.
