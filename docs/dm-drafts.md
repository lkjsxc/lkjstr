# Private draft storage

## Purpose

Describe encrypted local drafts and failed private sends, including storage
bounds, signer interaction and concurrent Worker behavior.

## Contract

The additive actions are `dm.draft.load`, `dm.draft.save` and
`dm.draft.clear`, each scoped to an account and an opaque tab key. A successful
load returns `Result.dmDraft` only when that slot exists. Absence is distinct
from a saved empty draft. Save and clear acknowledge only committed storage.
None of these actions sends or retries a message.

Load also returns an opaque `dmDraftRevision`, including for absence. Save and
clear may supply `expected`; they return the committed revision after success.
The token binds account, tab, removal generation and canonical state. A stale
editor cannot replace a newer committed edit. Omitting `expected` retains the
original per-operation CAS behavior for compatibility.

`DmDraftState` contains the current draft and up to 32 retained failed rows.
A retained row keeps its key, draft, optional stable failure code, delivery
counts and message ID. External error detail is discarded before persistence.
A pending send may be retained without an error; restoring it does not resume
the send or claim that an old Worker is still sending.

The frontend keeps unsaved state when a save fails. It serializes saves for one
tab and waits for an acknowledged flush before locking when a flush is needed.
The operation has a bounded deadline, so a refused signer or unavailable
storage cannot leave that acknowledgement waiting indefinitely.

## Bounds

| Value | Bound and behavior |
| --- | --- |
| Accounts with cached archive keys | 32; revoked keys are dropped |
| Queued/running draft jobs | 4; one job runs per account |
| Saved tabs per account | 32; no eviction |
| Serialized state per tab | 256 KiB |
| Serialized catalog per account | 2 MiB |
| Failed rows per tab | 32; no eviction |
| Tab/failed-row key | 256 UTF-8 bytes, nonempty, no control characters |
| Ciphertext archive | 6 MiB, at most 9 authenticated segments |
| CAS attempts | 3, within one overall deadline |
| Each storage transaction | At most 15 seconds |
| Signer wait | At most 60 seconds per request, within the same budget |

The 16 KiB send limit still applies to messages. An unsent draft above that
limit remains recoverable within the archive's state bound. A limit failure
returns `too-large` and does not evict another tab, discard an existing failed
row or partially replace the previous committed state.

## Encryption

The private `kv` record is `dm-drafts-v1:<pubkey>`. Its only fields are
`version`, `wrappedSeed` and `cipherCatalog`. Public events, public caches
and `localStorage` receive no draft text or failed-message bodies.

The first writable load creates a random 32-byte local archive key. The selected
account signer encrypts a small self-addressed NIP-44 seed payload containing
the schema, archive purpose, exact account and key. Local, extension and remote
signers use the same existing private-crypto bridge. No signing or publication
is needed for archive storage. Before returning an absent draft and its revision,
that load commits the wrapped seed and an encrypted empty catalog. It creates no
empty tab record. Refusal therefore happens before an editor accepts its first
unsaved character, and the first keystroke save does not introduce a first signer
prompt. Clear on a missing archive remains an explicit no-op.

The cached key is a zeroizing `ConversationKey`. A cold account session
unwraps its seed during the writable load. Usually this adds one decrypt request per account
session; a newly created archive adds one encrypt request. A competing first
writer or an account-removal generation change can require another unwrap.
A signer without NIP-44, refusal or a deadline returns the corresponding error;
the frontend retains the unsaved state.

The local NIP-44 implementation accepts at most 1 MiB per message. The catalog
therefore uses UTF-8 segments of at most 256 KiB instead of raising that bound.
Every encrypted segment contains an authenticated JSON header, a newline and
the exact catalog fragment. The header binds schema, purpose, account, random
batch identifier, part index, total count and fragment byte length. Fresh
CSPRNG nonces protect each segment. Decryption rejects tampering, a wrong
account/key, mixed batches, reordering and truncation before accepting a catalog.
The header framing avoids doubling JSON escapes for heavily escaped drafts.

## Leases and concurrent writes

Cached keys and queued draft plaintext belong to the Worker's Host state. No decrypted
catalog, key or Host borrow crosses a storage wait. Account revocation removes
those slots synchronously and aborts each tracked storage transaction. Every
await boundary checks the original account/client lease. Late signer replies
cannot reconstruct a revoked job, and each request settles at most once.

The archive read and compare-and-set use short IndexedDB transactions. A write
checks the exact earlier ciphertext and the job's pinned global archive nonce.
It also verifies that a current saved account with a usable signer exists.
On a ciphertext conflict the job reloads and decrypts the new catalog. Other
tabs merge. If the target tab changed, the operation fails instead of replacing
another writer's unsaved edit; an already-identical state is idempotent.

One non-secret `dm-drafts-generation-v1` nonce bounds removal metadata.
Account removal atomically deletes that account's archive, saves the account
list and rotates this nonce. A first save that began before removal cannot
recreate the archive after the same public key is re-added. Retries never
refresh a running job's pinned nonce. An unrelated in-flight save may need an
explicit retry after any account removal.

This nonce protects in-flight archive writes. It does not claim that separate
dedicated Workers share session unlock permission or receive instantaneous
account-state synchronization. A new request from another stale Host is outside
that narrower generation guarantee; the existing Worker-scoped lock behavior
remains documented separately.

## Verification

Native policy cases are in `engine_dm_drafts_test.rs`; encryption cases are in
`engine_dm_drafts_crypto_test.rs`. They cover absence/empty/failed records,
discarded error details, target-tab conflicts, independent-tab merge, bounds
without eviction, removal generation, authenticated restart recovery and
segment corruption. A heavily escaped near-limit catalog checks framing size.

The real Worker helper is `scripts/engine-drafts.mjs`. It owns a fresh browser
context and restricts Worker WebSockets to its loopback test origin. It checks
all three signer kinds, physical storage without plaintext markers,
lock/restart recovery, overlapping Worker writes, remove/re-add during a first
save, and a late signer completion after same-Worker removal. It never loads an
owner account or publishes to a public relay.

On 2026-11-16, ten native cases passed: three encryption cases and seven
policy/removal cases, including the stale-editor revision guard. The Worker
WASM check passed after registration. The sequential unrelated-tab revision
assertion also passed. Focused real Worker signer tests passed archive refusal
and same-public-key replacement with no late first-save commit; their dated
evidence is in [Private signer lifetimes](dm-signers.md). The focused archive
helper passed all 50 checks at 11:09:15.457--11:09:19.501 UTC, load
0.98/1.50/2.49, against the unchanged integration WASM recorded in
`tmp/archive-focus-direct-served.json`. The normal combined conformance gate
also passed at 11:12:44--11:16:19 UTC (215.102 s), load averages
1.22/1.42/2.26 to 3.45/2.23/2.38; report
`tmp/engine-harness/report.json`. Deployment is recorded separately.

The first combined attempt exposed a test-runtime issue: fulfilling a Worker
script through Playwright caused its loopback sockets to close before reaching
the server. An independent 16-case probe isolated script delivery from WASM,
signers and the socket guard. Directly served or continued scripts passed all
eight cases; fulfilled scripts failed all eight. The helper now serves a
separate guarded Worker directly, preserving the exact owned-origin check and
HTTP restrictions. See `tmp/ws-worker-route-probe-report.json`; this observation
describes the installed test runtime, not a general browser limitation.

## First-load effect regression

The focused command is
`node scripts/engine-dm-signer-harness.mjs --first-load`, using
`LKJSTR_ENGINE_PKG` and `LKJSTR_ENGINE_REPORT` for immutable package/evidence
directories. It includes extension, bunker, native local crypto and a forced
two-Worker initial seed race.

On 2026-11-16, the prior package
`31ca2d67f2f4a03c67b035f86e8fe8d7ba074fbc50aa8aa3b621aaf0f2bd827c`
failed seven of 14 checks: an absent load returned writable success before
authorization, and the first character's save introduced the first signer
prompt. The run was 10:17:10.570--10:17:15.997 UTC at load averages
5.94/5.57/5.39 to 5.79/5.55/5.39.

The corrected production package
`60bdaf0132d3e24f687544b9ceaaf29a1811a554d736f12bf9e5fea31aa48fef`
passed all 18 checks at 10:23:30.880--10:23:36.176 UTC, with load averages
6.29/5.54/5.33 to 7.15/5.73/5.39. Refusal happened before writable absence;
successful initialization preserved the absent-state revision and introduced
no first-keystroke prompt. In the forced race, the CAS loser unwrapped the
winning seed, both loads returned the same revision, and both Workers read the
subsequent committed state. No empty tab or plaintext archive was created.

Reports are `tmp/dm-first-load-before/report.json` and
`tmp/dm-first-load-after/report.json`, with adjacent logs. All owned browsers,
fixture helpers and loopback listeners were closed.
