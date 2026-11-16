# Specified interface verification

## Purpose

Record the 2026-11-16 K1-K4, M1-M6 and D1 integration evidence and its limits.
The integration is based on `e4fd5b0e`; all seven required gates passed.
Protocol 8 preserves every existing message and field. This record covers
Claude's written structures and strings plus the private engine work they need.

## Final gates

All seven required gates passed on the final runtime and interface source.
All builds/native tests use four jobs. Starts below are UTC on 2026-11-16;
loads are one/five/fifteen-minute host averages, not controlled benchmarks.

| Gate | Start UTC | Seconds | Load before | Load after |
| --- | --- | --- | --- | --- |
| check:repo | 11:46:29 | 0.649 | 2.00/1.60/1.77 | 2.00/1.60/1.77 |
| test:quiet | 11:46:30 | 65.484 | 2.00/1.60/1.77 | 1.89/1.68/1.79 |
| rust-wasm:quiet | 11:47:35 | 71.768 | 1.89/1.68/1.79 | 1.73/1.67/1.77 |
| verify:quiet | 11:48:47 | 67.141 | 1.73/1.67/1.77 | 1.83/1.74/1.79 |
| web check | 11:36:04 | 5.941 | 1.58/1.65/1.89 | 2.34/1.80/1.94 |
| web build | 11:49:54 | 0.321 | 1.83/1.74/1.79 | 1.83/1.74/1.79 |
| web smoke | 11:49:54 | 369.480 | 1.83/1.74/1.79 | 1.98/1.71/1.72 |

Web smoke includes the mock interface, 128 real upload checks and offline-shell
scenarios. The repo check is repeated after documentation closure. Exact logs,
loads and prior failed attempts remain in `tmp/third-gates-20261116.json`.

## Complete real Worker conformance

The normal `sh scripts/engine-check.sh` gate passed on its third attempt,
11:12:44-11:16:19 UTC, in 215.102 seconds. Load changed from
1.22/1.42/2.26 to 3.45/2.23/2.38. It passed 425 main checks with zero page errors
and ordinary fixture clocks, plus 18 transport, 34 retained-stop and 22 private
signing checks. The delayed-profile probe measured 308.2 ms with an injected
240 ms relay delay. All relay/signing traffic used owned loopback fixtures.

The harness WASM SHA-256 is
`5892a8a48d38b761a3e428955524837b9e450b167dd86a4e088197b5d857f785`.
The main report is `tmp/engine-harness/report.json`; preflight reports remain
in `tmp/engine-stop/` and `tmp/engine-dm-sign-deadlines/`.
The build now honors `CARGO_TARGET_DIR` for both compilation and wasm-bindgen,
preventing an older checkout-local output from being packaged accidentally.

Two fixture issues were diagnosed without changing product behavior:
the installed browser setup rejects sockets from fulfilled Worker scripts before
the loopback server receives an upgrade. A 16-case independent reproduction
distinguished served/continued scripts from fulfilled scripts. Serving the same
strictly guarded archive script directly passes all 50 archive checks against
the exact formerly failing WASM; no guard was relaxed. The AUTH fixture also
matched an older bootstrap row before a newly signed owner relay list finished
verification. It now waits for that exact stored event and explicitly queries
its challenge relay. Original reports are preserved, not relabeled as passes.

## Screenshot matrix

`pnpm shots` ran from 09:48:11 to 09:58:17 UTC in 606.188 seconds.
Load changed from 3.41/4.58/4.70 to 7.81/6.50/5.66.
It generated 39 specified K/M states across 12 width/theme/language combinations:
468 required captures, 888 PNGs including older compatibility scene names.
Every required capture was indexed and all 16 review sheets inspected.

The review index is
`tmp/screens-interface-20261116-matrix/review/index.html`;
dimensions and coverage are in its `review.json`.
No overflow, added wording or specified layout mismatch was found.
Later private-state/lifecycle fixes change neither strings nor CSS.
The final design judgement belongs to Claude, not this engineering review.

The screenshot runner also cleans its owned server when browser launch fails;
before/after missing-browser logs are retained. No unrelated service was stopped.

## Real specified controls

Fresh isolated loopback contexts use generated accounts, never an owner account.
The key-only runner passed all 13 assertions at 10:32:12 UTC in 6.576 seconds.
Load changed from 7.92/7.87/6.35 to 7.28/7.74/6.31.
It exercised create, protect, lock, unlock, wrong password, exact encrypted
download and re-import of the same identity; no event publication or page error.
See `tmp/vault-ui-report.json` and `tmp/vault-ui-final-result.json`.

The first complete message runner passed 15 assertions at 10:37:11 UTC
in 8.069 seconds, starting load 1.31/3.95/5.10, with no page errors.
It exercised the actual inbox Save control, private send, own wrapped copy,
encrypted reload, public-storage plaintext exclusion and a second page's Lock
while the first page's encrypted write was held. Unlock restores the exact tail.
Evidence is frozen in `tmp/dm-ui-real-after/`.
The final message runner passed all 16 checks, including inbox-state stability,
at 10:57:49 UTC in 11.561 seconds, starting load 6.33/3.44/3.65.
It used the then-current production WASM plus current entry scripts and transport.
`tmp/dm-ui-real-final/` preserves the report, exact input/built asset hashes
and timing. The earlier failing stability trace remains separate.

A preliminary key helper incorrectly expected every Accounts tile to disappear
after sign-in. The product correctly removed the guest tile and restored the
reader's saved layout; the corrected assertion checks that exact transition.
That was a fixture correction, not a production fix.
Full mock smoke also exposed broad ordinary-relay field selectors after M4 added
another prescribed field, and an old Docs tree expectation after D1. Selectors
now scope to the ordinary relay entry; the exact Docs equality includes the new
page in its specified position. Content/caret assertions remain unchanged.

The first full real-UI run passed 533/534 checks with zero page errors in
514.708 s at 11:14:02 UTC, load 1.07/1.35/2.17 to 1.99/1.78/2.09.
Its hang-sign fixture waited for an obsolete missing-signer code after the
engine correctly returned `signer-timeout` at 60.002 s. Correcting only that
expectation passed 8/8 focused checks at 11:28:53 in 60.902 s, load 2.10/1.95/2.07;
the actual deadline was 60.009 s, with no publications or page errors.
All 34 production asset hashes remained identical. Draft, Retry and reload
recovery passed; this focused correction is not a second full-UI run.
See `tmp/smoke-real-hang-sign-{before,after}/`. The corrected full UI gate then
passed all 545 checks with zero page errors during shipping, completing at
12:10:37 UTC. The entire ship took 551.593 s including builds/deployment/checks,
not just UI execution. `tmp/third-ship-evidence/` in the canonical worktree keeps
the report, archive hash and served-page verification. Main was already pushed;
the redundant final push failed authentication and its misleading desk label
was corrected after independently verifying the remote ref.
Public HTTPS timed out from this workspace at 12:27:50 UTC; a separate fetch
also failed. External reachability is unconfirmed; host edge/index checks passed.

## Reproduced defects and focused proofs

- Fresh accounts omitted `Account.inbox`; Messages hid the existing setup
  control even after a confirmed `unsupported/not-found` answer. The real flow
  and focused DOM case failed before. The specified control now follows that
  evidence and survives transient loading until a usable advertisement arrives.
- Missing inbox discovery alternated with loading when the scheduler rotated a
  completed live lookup. Native reproduction failed at 1,200 ms; retaining its
  historical EOSE evidence passed three new and eight related cases in 2.181 s
  at 10:41:16, load 2.66/3.48/4.64 to 4.77/3.91/4.77. Unanswered lookup and
  pending verification still cannot prove absence. The frozen real build failed
  the added stability check in 5.016 s at 10:40:39, load 3.19/3.68/4.75;
  `tmp/dm-inbox-stability-before/` records the alternating snapshots.
- Cross-page Lock previously could revoke the last unsaved editor tail. Core
  editor leases, serial flush grants and a 15-second aggregate barrier now wait
  for encrypted commits. The original production package fails the reproduction;
  the final pre-stop package passed 24 real Worker checks. Evidence and the
  conservative orphan policy are in [dm-editor-locks.md](dm-editor-locks.md).
- Initial empty draft load previously postponed external seed wrapping until
  the first keystroke save. Refusal then arrived after editable text. Establishing
  encrypted storage before writable absence passed 18 raw Worker checks,
  including a two-Worker first-writer race; see [dm-drafts.md](dm-drafts.md).
- Refusal, hide, Retry and same-public-key signer replacement could leave stale
  slots, late replies or bunker sockets. The frozen before package failed 17
  of 25 checks; the corrected package passed 44 checks with real 60-second
  deadlines. See [dm-signers.md](dm-signers.md).
- Exact-event DM signing used ordinary upload error mapping, turning signer
  deadlines into missing-signers and collapsing an unsupported bunker response.
  A private wrapper preserves the same event validation and 60-second budget
  while distinguishing deadline, absence and refusal. The original frozen
  package failed five checks; the corrected production package passed 22/22
  at 10:53:01 in 2.663 s, load 1.85/2.40/3.68. These tests fire the original
  requested 60,000 ms timer callbacks; elapsed wall time is not 60 seconds.
  Evidence: `tmp/dm-sign-deadlines/{before,after}/`.
- Explicit stop previously retained decrypted inbox messages, queued sends,
  publication rumors and the Host's account keys. Both retained handle kinds
  failed ten of 34 checks before and passed 34/34 after at 10:44:50 in 0.712 s,
  load 4.60/4.38/4.79. Durable accounts and archive revisions remain unchanged.
  Feature-gated counts probes reveal neither bodies nor keys; production
  exports omit them. A wider stopped-Host probe then found queued account and
  startup inputs, private policy and sessions retained. Its frozen before
  package failed 13/46; permanent queue/projection disposal, closed output and
  post-stop input rejection passed 46/46 at 11:32:59 in 0.661 s, starting load
  1.36/1.74/1.96. Durable restart still passed. See
  [dm-signers.md](dm-signers.md) for exact hashes and transient-copy limits.
- The fallback port-host entry retained its global callback after stop/free and
  left a late transferred port open; three checks failed. Clearing callbacks
  only on first stop also preserves a replacement handle on the same global.
  All 72 expanded checks passed at 11:44:47 in 1.050 s, load 1.33/1.42/1.74
  to 1.55/1.47/1.75. The frozen final probe and failed reports are recorded in
  [dm-signers.md](dm-signers.md); no ordinary lock/remove policy changed.
- Old shared/fallback transport callbacks could cross connection generations.
  Six race cases failed before; the updated transport passed its 11 cases.
  Retained `pagehide` then exposed unconditional detach and a permanently closed
  transport on return. Six new cases failed before; all 18 combined transport
  cases passed at 10:40:50 in 0.061 s, load 2.85/3.59/4.71.
  These simulate lifecycle events; they do not claim actual browser BFCache
  admission. Evidence: `tmp/transport-history-result.json`.

Native and DOM tests also cover account-bound drafts, missing revisions,
cross-tab CAS conflicts, lost save acknowledgements, partial sends, clean/dirty
editor expiry, late registration, lock failure, retained read marks and exact
recipient/self delivery totals. Fresh ports, browser contexts and helper
processes are released on both success and failure.

## Scope and remaining limits

Unlock remains Worker-scoped. Another connected client can keep a reload
unlocked; strict per-page permission is the recorded K2 difference.
Unresolved expired editors prevent Lock until recovered or the Worker ends.
An abrupt crash before the first successful encrypted write is not durable.
Public relays are never used by these key/message tests, and no payment occurs.

Private body models, mounted rows, conversations, failed sends, draft bytes,
signer calls and editors are bounded as documented in their owning modules.
The third read-only hour started at 12:13:43 UTC on shipped `541e4a1e`, with
fresh helpers and frozen build bytes; its full hour and fault phases are ongoing.
Firefox, Safari, physical laptop sleep and browser-process crashes remain
unmeasured; mock captures and loopback tests do not establish those behaviors.
