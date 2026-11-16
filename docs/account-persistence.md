# Account persistence

## Purpose

Protect the durable account record when independent Worker graphs share one
IndexedDB database. This correction adds no account surface, words or protocol.
Focused native and production-Worker checks passed; the full release gates
and additional actual IndexedDB boundary checks remain pending.

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

## Focused verification and remaining gates

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

Schema blocking, late canceled opens, malformed present values, failed-boot
request settlement and removal atomicity still need actual IndexedDB proofs.
The full release gates are also pending. No test-only production export is
introduced. This evidence does not claim global account reconciliation,
physical memory zeroization in JavaScript, or an owner-account incident.
