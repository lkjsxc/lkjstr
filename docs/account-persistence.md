# Account persistence

## Purpose

Protect the durable account record when independent Worker graphs share one
IndexedDB database. This correction adds no account surface, words or protocol.
Focused native, production-Worker and actual IndexedDB boundary checks passed.
All required release gates, real smoke and packaging passed at `04c10b9b`.

## Observed old behavior

On 2026-11-16 at 22:00:00 UTC, two actual Workers using immutable production
runtime `cada84e1` shared fresh synthetic accounts. One held an old account
snapshot while the other added a key or protected an existing local key.
An ordinary Seen action from the stale Worker acknowledged its whole-record
write. The newly added account disappeared; in the separate protection case,
the stored encrypted account returned to its old plaintext representation.
A third Worker reproduced each persisted outcome. Six preservation/rejection
assertions failed and all six setup/current-snapshot controls passed.

The 1.822-second run observed load 1.88 / 1.69 / 1.77. Its report is
`tmp/account-before-proof/try2/report.json`, SHA-256
`d449cb7e46ada6eecaa69ec685287cc842719e09fa4816104fb4a42f3f5fa67e`.
The unchanged production WASM is
`9088e280584f9c35372b96b6fbd2a07b4ee6e14b3c276b4f45f5f44b0ebe6aef`.
The first attempt had zero assertions: Chromium rejected an overlong local
socket path. That setup failure remains separate from the successful red proof.
No owner account, public socket, saved browser data or live occurrence is claimed.
All owned Workers, browser processes, server and temporary profile were reaped.

## Same-database fence and strict load

The candidate opens the existing `lkjstr-wasm` database at schema 2. Its upgrade
preserves account, event, private archive and removal-generation rows; it adds
only checked account revision metadata after validating the existing account
record. It never deletes/recreates a database or substitutes an empty wallet
for an unavailable read. Both fixed keys use get and getKey in one transaction:
a present undefined value is malformed, while only a genuinely missing account
row at the initial revision can initialize empty.

An older explicit schema-1 opener cannot write after schema 2 commits. An
already-open old connection blocks that upgrade. The new opener has one owned
15-second deadline and no automatic retry. Its inactive flag remains with the
native request until completion: a late upgrade is aborted and a late success
is closed. Stop also revokes the opener. There is at most one pending opener
per Host, although a blocked native request can outlive its caller until the
old connection closes.

Failed boot sends the existing capability handshake without an Accounts
snapshot, then directly fails queued/future actions and view requests. This
also releases the transport's pre-handshake action queue. It does not claim
there are no accounts, start signer work, or retain queued secret inputs.
Later shared clients receive the same failed-boot handshake and request rules.

An active corrected connection conservatively stays open until normal explicit
Host close when another schema upgrade requests it. A future opener may fail
boundedly; it cannot silently purge an older Host's unflushed editor state.
The relevant browser rules are the IndexedDB opening and closing algorithms:
https://w3c.github.io/IndexedDB/#opening and
https://w3c.github.io/IndexedDB/#closing-connection .

The schema fence also defines rollback compatibility: an old schema-1 bundle
cannot reopen an upgraded browser database. The account-fix release must become
the retained compatible fallback before later performance releases. Host rollback
must select a schema-2-compatible bundle; no downgrade or data reset is attempted.

## Atomic snapshot commits

Every account mutation carries the revision loaded by its Host. In one
readwrite transaction, the effect reads the account record and revision,
validates both, compares the expected revision, and only then queues writes.
Account removal, encrypted draft archive deletion, and removal-generation
rotation remain in this same transaction. A mismatch writes none of them.
Revision advancement is checked and cannot wrap or reuse a removed state.

Only a confirmed transaction commit advances the Host baseline or publishes
Accounts/action success. Raw and encrypted key export, session Lock and Unlock
check the same freshness boundary without rewriting durable credentials.
The queue remains finite and serialized. Stop or client detach aborts its owned
transaction; no stopped Host publishes a late key result or adopts a snapshot.

A conflict returns the existing rejected failure and marks that Host stale.
It does not replay a key operation, silently merge another writer, replace
Accounts wholesale, or drop the Host's unchanged session keys/editor text.
Further durable account operations fail until explicit reload. This is a
conservative durable no-key-loss boundary, not automatic reconciliation or
immediate cross-Worker revocation. Lock remains Worker-scoped; a global lock
would require a separate editor flush quorum before any durable revocation.

## Focused verification

Eight native policy cases passed for strict load, malformed revisions, CAS,
removal/re-add identity, read-only freshness, terminal conflicts and checked
overflow. Fifteen adjacent vault/draft cases also passed: 23 total in 20.101
seconds, including build time, at load 1.32 / 1.61 / 1.78. The first WASM
preflight found two new glue compile errors; the typed callback and failed-DM
projection corrections are retained with the original diagnostics.
Corrected WASM check, core all-target strict Clippy and Worker strict Clippy
passed in 1.616, 6.826 and 4.973 seconds respectively. Every standalone Cargo
call recorded exact source hashes and refreshed owned Rust/manifests first.

The production-only package built in 25.209 seconds and passed its generated
export audit. Its immutable WASM is
`59e2121a2dfc9c5c2f1e10963edf65f0f18c4fed0d5f86e0f4f0a1869c727cc5`;
loader `d69b6219eb9201b6b84c6579ff07ff1dd8b0993b026470a92e8351522fc1f179`.
The exact unchanged frozen before fixture then passed all 12 assertions at
22:17:52 UTC, load 2.04 / 1.71 / 1.77. Internal fixture elapsed time was 1525 ms;
outer runner elapsed time was 1.716 seconds. The report is
`tmp/account-after-proof/try1/report.json`, SHA-256
`20fdad0832635acbeb6fe53a6684f511fe42362449787271270945e54618cdd6`.
It observed zero page errors, external HTTP requests or sockets; all owned
resources were reaped. The public ninth measurement was running independently;
its source, assets, browser and collected data remained untouched.

The actual IndexedDB guard suite passed 105 assertions across 15 fresh contexts
at 22:25:37 UTC in 33.733 seconds, load 1.55 / 1.61 / 1.73 to
1.53 / 1.58 / 1.71. It covered schema blocking, late aborted upgrades and
closed successes, present undefined/malformed records, a real read abort,
failed boot including later shared clients, and removal conflict/commit/abort.
Its report `tmp/account-guards-proof/try1/report.json` has SHA-256
`d191bea4d95d1eb5e076092ddcfdb34da8f4f35bbcd2eda22c31a91f66f3b02f`.
A source review then strengthened the shared fixture's Worker-error check to
inspect its root owner. Only that case reran: 10 overlapping assertions passed
at 22:28:40 UTC in 0.428 seconds, load 3.58 / 2.23 / 1.93. Its report is
`tmp/account-guards-proof/shared-owner/report.json`, SHA-256
`b524fdd22ce8e1058f48e9a286e44a21a27fd7d058bfcae49d2dd48427c7fb9b`.
These are 105 guard assertions plus a strengthened overlapping case, not 115
unique assertions. Both runs retained the same immutable production bytes,
observed no outside requests/sockets or page errors, and reaped owned resources.

The maintained `pnpm accounts:check` audits explicit current/older production
packages then runs the race and guard helpers under separate fresh reports.
It requires `LKJSTR_ACCOUNT_PACKAGE`, `LKJSTR_ACCOUNT_WASM_SHA256`,
`LKJSTR_ACCOUNT_LOADER_SHA256` and the matching `LKJSTR_ACCOUNT_LEGACY_*`
variables. Set a short owned `LKJSTR_TEST_TMPDIR`; `LKJSTR_CHROME` can pin the
browser. `LKJSTR_ENGINE_REPORT` selects a fresh output directory. The wrapper
passed against the final production package: 12 race and 105 guard assertions.
A separate production Storage fixture passed 19 checks. Command times, loads,
report identities and fixture corrections are in
[engine-account-verification.md](engine-account-verification.md).
No Cargo build is implicit in this production-artifact command.

## Completed release checkpoint

At unchanged source `04c10b9b`, the eleven stages below passed on 2026-11-16.
The first engine stage began at 23:08:38 UTC; packaging finished at 23:38:51 UTC.
The seven required gates are included, with the extra production checks shown
separately. All stages retained the same tracked-source SHA-256 and reported no
remaining owned processes. The maintained production checks followed at
23:39 UTC; their assertions overlap earlier focused evidence, with separate
command reports and final artifact bindings.

| Stage | Seconds | Result |
| --- | ---: | --- |
| check:repo | 1.200 | passed |
| test:quiet | 163.568 | passed |
| rust-wasm:quiet | 132.403 | passed |
| verify:quiet | 132.374 | passed |
| web check | 9.122 | passed |
| web build | 0.529 | passed |
| engine conformance | 328.904 | 459 main checks passed |
| web smoke | 402.682 | 418 mock and 131 upload checks passed; offline checks passed |
| real build | 28.741 | passed |
| real smoke | 534.800 | 541 checks passed; zero page errors |
| package | 0.761 | passed |

Real-smoke load was 4.81 / 5.14 / 5.21 at start and 7.61 / 5.98 / 5.44 at end.
The production WASM and loader hashes exactly match the focused corrected
package above. The 1,601,690-byte archive SHA-256 is
`1731c7073b30247ecd83e46fb64801d079b9ae4ff0019c7ce97ecf99169d29a2`.
The ledger, source manifests, logs and frozen artifacts are under ignored
`tmp/account-release-*`; the bounded summary is
`tmp/account-release-evidence-04c10b9b.json`. The real-smoke report SHA-256 is
`758477d33690ad3591b186ea41ad0b88367579b4c4bf0ea39179dacd83a501f7`.

No test-only production export is introduced. This evidence does not claim a
new deployment, automatic account reconciliation, physical memory zeroization
in JavaScript, or an owner-account incident.
