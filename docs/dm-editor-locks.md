# Private editor lock coordination

## Purpose

Keep a shared account lock from discarding another page's unsaved private
draft. The frontend owns editing; the engine owns whether its account mutation
can commit. No message body travels between pages.

## Contract and ordering

Protocol 8 adds three operations:

- `Action.dm.editor {as,editor,open,dirty?}` registers or releases an opaque
  per-mounted-store UUID. Registration must succeed before editing is enabled.
- `FromEngine.dm.flush {req,account,phase}` asks a registered page to prepare,
  or releases its hold after success/failure.
- `ToEngine.dm.flushed {req,ok}` acknowledges only that page's current attempt.

The optional dirty flag becomes true before an unsaved revision is exposed and
false only after the latest encrypted archive write commits. Every live editor
participates even when marked clean: another page's input can be in flight.

The account mutation queue reserves the lock and asks every participating page
to hold edits, then grants one page at a time permission to flush. Per-page
writers are serialized too, preserving the four-job archive bound. New editor
admission stays closed through the actual
account transaction. A negative answer, missing answer, stale identity or
failed encrypted write cannot be treated as success. Preparation has one
15-second budget. The normal account failure result leaves the key unlocked.

Once all current pages acknowledge their latest stored state, the Worker
commits the lock, synchronously revokes private state and sends authoritative
locked accounts before the release. Other account mutations remain serialized.
If the account transaction fails, the old authority remains and the hold is
released. Draft jobs continue under the old key while preparation waits.

The frontend also waits for owned sends to settle and stores their terminal
outbox state. A send that cannot finish within the preparation budget prevents
this lock attempt. Private input is held until release; hiding an editor alone
does not certify a save.

## Identity, expiry and bounds

The Core coordinator holds at most 128 editors, at most 32 per attached client,
and one preparation for the serialized account queue. Entries contain account
IDs, opaque editor IDs and state flags, never private text or keys.

Prepare IDs include a random 16-byte Worker namespace and a monotonically
increasing counter. Replies are matched to the participant's port and exact
attempt. A prior Worker or a prior attempt cannot finish a later lock. The
transport also rejects output from old connection generations and leader
epochs, including stale welcome messages.

Closing an unrelated account's editor cannot fail this account's preparation.
A participating page disappearing before its answer fails the attempt.
Heartbeat expiry preserves every editor as an unresolved, bounded lease. Even
a last-known-clean page can have its first dirty frame queued when it freezes.
A later lock fails until the same editor UUID re-registers with its actual
current state and confirms its save. A live clean editor still participates.

Explicit page detach releases that page's editor leases. Closing/crashing a
page before an encrypted write succeeds is not a durable-save guarantee.
An editor page that expired and is then lost cannot certify its state; its
unresolved lease remains until the Worker restarts or the account is removed.
Worker restart already locks encrypted local keys and preserves acknowledged
encrypted drafts. No timeout silently turns an unresolved dirty lease clean.

The coordination covers opt-in protocol-8 private editors. Older protocol
clients do not have this new editor surface. It is not a per-page key vault:
unlock remains Worker-scoped, as documented in [keys.md](keys.md).

## Measured reproduction (2026-11-16)

The isolated harness creates fresh local accounts, imports their explicitly
requested encrypted backup, opens several ports to the production port host,
and blocks every WebSocket before WASM starts. It uses no owner account,
external signer, saved browser profile or public relay.

Before: the second landing's frozen production WASM
`ded9b5cd7d27a59966dc709afc1c22938f31980d653b59f1ef5e23a1502181c0`
locked immediately from another page. Its older protocol ignored the new
editor registration; the regression asserts that unflushed editing must block
the lock. The expected failure ran 10:14:57.945-10:14:59.318 UTC at load
7.09/4.74/5.10. Evidence: `tmp/editor-locks-before-complete/report.json`.

After: production WASM
`31ca2d67f2f4a03c67b035f86e8fe8d7ba074fbc50aa8aa3b621aaf0f2bd827c`
passed all 22 checks, 10:14:56.284-10:15:13.490 UTC, 17.206 seconds.
Load changed from 5.19/4.33/4.97 to 6.80/4.78/5.11. It covers new admission,
wrong-port/stale acknowledgements, false dirty acknowledgements, successful
encrypted save/lock/unlock, account-before-release order, physical plaintext
absence, failure, the actual 15-second deadline and dirty expiry/re-registration.
Evidence: `tmp/editor-locks-after/report.json`.

Expiry uses a 181-second Worker clock advance; this is not an OS sleep test.
The initial older-package fixture timeout preceded the assertion because that
protocol did not acknowledge its unknown action. It remains separately under
`tmp/editor-locks-before` and is not counted as a product failure.

Twelve native coordinator cases and the Worker WASM compile also passed.
The additional clean-expiry race fails the initial coordinator and passes after
preserving every unexpectedly expired editor. Logs:
`tmp/editor-clean-expiry-before.log`, `tmp/editor-coordinator-after.log`.
The production package tested at 10:24 UTC
`60bdaf0132d3e24f687544b9ceaaf29a1811a554d736f12bf9e5fea31aa48fef`
passed the expanded 24 checks, 10:24:17.033-10:24:34.238 UTC (17.205 seconds),
at load 7.67/6.01/5.50 to 6.52/5.86/5.46. This adds the last-known-clean
expired-page guard and sequential save grants while every participant is held.
It includes the initialized archive-seed fix. Evidence:
`tmp/editor-locks-final/report.json`.

The transport's six stale-callback regressions fail against its exact prior
source; all eleven current tests pass. Logs:
`tmp/transport-races-before.log`, `tmp/transport-races-after.log`.

The Worker conformance suite includes the current check. The isolated
runner accepted `LKJSTR_ENGINE_PKG` and `--before` for the older package.

```sh
git show 8e8733596086e5dbdd75e8cb3be5b1af27113134:scripts/engine-editors-harness.mjs
```

The 16-check real message flow also passed cross-page Lock and
exact-tail restoration; its dated evidence and the final integration gates are
recorded in [interface-verification.md](interface-verification.md).
