# Encrypted local keys

## Purpose

Protocol 6 adds NIP-49 import, explicit encrypted backup, session unlock and
lock. The Accounts tab implements Claude's K1-K4 specifications for these
operations. Existing plaintext accounts continue working without migration.
Importing an encrypted backup explicitly replaces the same account's plaintext
record only after password validation and a successful storage commit.

## Contract

All operations use the existing `act {req,action}` envelope and exactly one
`result`. Accounts remain `signer:"local"`; two optional public flags describe
whether the key is encrypted and whether this Worker can currently use it.

| Addition | Shape and behavior |
| --- | --- |
| Import | `{a:"account.importEncrypted",key,password}`; key is ncryptsec; authenticate, derive its pubkey, persist ciphertext, then make it active and unlocked. |
| Unlock | `{a:"account.unlock",pubkey,password}`; validate the envelope and account pubkey, retain the decrypted key only in this Worker. |
| Lock | `{a:"account.lock",pubkey}`; remove the decrypted session key; plaintext accounts return unsupported. |
| Encrypted backup | `{a:"account.exportEncrypted",pubkey,password,logN?}`; an unlocked local key returns `result.encryptedKey`. This does not migrate storage. |
| Account state | `Account.encrypted?:boolean`, `Account.locked?:boolean`; no ciphertext, password or local secret appears in account summaries. |

The existing `account.key` action still returns only a raw nsec after an explicit
backup request; encrypted accounts must be unlocked first. The new encrypted
backup field never aliases the existing `key` field.

Unknown account: not-found. Wrong password, authenticated wrong pubkey, malformed
encoding or weak export parameters: rejected. Unsupported signer or plaintext
lock: unsupported. Locked signing/decryption/backup: signer-missing. Excessive
password length or KDF cost: too-large. Storage/RNG failures: internal.
Errors and Debug output never include passwords or key material.

## Cryptography and resource policy

The codec follows [NIP-49](https://github.com/nostr-protocol/nips/blob/master/49.md):
format 2, original Bech32 with ncryptsec HRP, exactly 91 decoded bytes, salt 16,
nonce 24, one authenticated key-security byte, 32 encrypted secret bytes and a
16-byte authentication tag. The parser checks length, format, checksum,
canonical padding, security byte and KDF budget before deriving a password key.

Passwords use Unicode NFKC before scrypt. RustCrypto scrypt fixes r=8, p=1 and
32-byte output. RustCrypto XChaCha20Poly1305 authenticates the security byte and
decrypts a fixed in-place buffer; the decrypted scalar must be a valid
secp256k1 key. Cryptographic primitives are dependencies, not local copies.

Imports accept logN 1 through 18 for interoperability. Exports require 16 through
18 and default to 16. At r=8, the main scrypt workspace is 64 MiB at 16 and
256 MiB at 18. Higher-cost envelopes return too-large without allocating that
workspace. Passwords are limited to 1024 UTF-8 bytes before and after NFKC.
The shared account queue runs at most one KDF at a time and holds at most 32
queued requests. KDF work currently runs synchronously in the Worker and may
briefly delay its other work; it never runs on the rendering thread.

Every export gets independent salt and nonce bytes from the browser CSPRNG,
with failure propagated. The core accepts explicit entropy solely to keep
native tests deterministic. Older plaintext exports carry security byte 0.
Encrypted imports with known exposure retain 0; other re-exports use 2 because
raw-backup history is not tracked. The engine never asserts unobserved safety.

## Storage and session lifetime

The durable account has `encrypted_key` and no plaintext secret value.
Its `unlocked_key` is serde-skipped. Restarting the Worker therefore leaves the
account locked, while public read access and identity remain available.
Existing pre-vault serialized account records still deserialize and sign.

Mutation runs on a cloned account snapshot. The Worker commits that snapshot
through the existing IndexedDB account transaction before replacing live state
or emitting success. A bad password, wrong account, capacity rejection or
failed transaction leaves the previous account and key intact. Exporting
ciphertext is explicit; it does not silently rewrite plaintext storage.
Replacing an encrypted account with an explicit local/extension/remote signer
clears obsolete vault credentials. Importing only an npub does not downgrade it.

Owned passwords, local secret strings, session key bytes, NFKC password copies,
derived keys and in-place plaintext buffers use zeroizing wrappers.
The RustCrypto AEAD key is zeroized by its implementation. This is not a claim
that browsers erase input strings, compiler temporaries or every allocator page:
scrypt 0.11 does not explicitly zero its internal mixing workspace.
See [RustCrypto AEAD](https://docs.rs/chacha20poly1305/0.10.1/chacha20poly1305/)
and [scrypt implementation](https://docs.rs/scrypt/0.11.0/src/scrypt/lib.rs.html).

## Verification

Native cases live in `crates/lkjstr-nips/src/nip49_test.rs` and
`crates/lkjstr-core/tests/engine_vault_test.rs`. They cover the official
decryption vector, NFKC equivalence, wrong passwords, tampering, malformed
envelopes, bounded costs, invalid scalars, reload/lock, old accounts, failed
replacement, explicit export, account mismatch and redacted Debug output.

`scripts/engine-vault.mjs` runs in the existing loopback Worker harness using
the public NIP-49 test vector. It inspects only the fixture's account entry,
checks ciphertext-only IndexedDB state and locked restart, exercises every new
action, and restores the preceding fixture account. No public relay receives
test traffic. Mock fixtures use a visibly non-NIP-49 marker so they cannot be
mistaken for real backups. `web/tests/vault.test.ts` checks their contract.

After a real UI build, `node web/scripts/smoke-vault-only.mjs` checks the
specified controls with a fresh Worker-generated account and an empty loopback
relay, including downloading and re-importing the protected copy. It needs no
native fixture build and writes tmp/vault-ui-report.json. The same helper is
also included in smoke:real.

Run status belongs in docs/status.md and the landing's gate record. Native
test code and this specification do not by themselves claim a browser run.

## Accounts surface and session scope

[interface-keys.md](interface-keys.md) defines the exact K1-K4 surfaces and words.
Fields empty when sent; password forms and backup values never enter tab state.
An imported ciphertext survives only its password step, cleared on cancel, tab
leave or one hidden minute. A raw backup starts folded and is cleared on fold,
page hide, lock/remove intent, account revocation or box teardown; delayed
replies cannot restore it.
Choosing a new password requires two equal fields of at least eight characters.
Import and unlock accept an existing empty password, as the native codec does;
the new-password rule never prevents reading a compatible existing backup.
Export uses the default KDF cost. Downloaded copies use the specified npub-based
filename. Protection exports first and imports only while that operation remains
open, preserving the working account unless the authenticated import commits.

The idle-lock setting defaults to zero. A positive minute count uses key presses
and pointer movement across live lkjstr pages. A throttled BroadcastChannel
carries only finite, nonfuture activity timestamps and probes, with at most one
pending broadcast per page. Hidden time counts when every page is idle; expiry
and wake allow a 750 ms activity probe before locking. The default-off setting
opens no activity channel. Dispose closes its channel and cancels every timer.
Lock affects every client sharing the Worker. Reload alone may stay unlocked
when another client keeps that Worker alive, a recorded K2 implementation
difference. Strict per-page protection needs client-bound vault and decrypted
cache leases. Cached public faces restore as locked until authoritative state.

The 34 focused DOM regressions cover pre-status revocation, delayed backup
replies, account-state-before-result ordering, existing empty passwords and
shared idle/wake behavior. They live in web/tests/vault-ui-*.test.ts.

On 2026-11-16, pnpm shots completed at 09:58:17 UTC in 606.188 seconds. The
start/end load averages were 3.41/4.58/4.70 and 7.81/6.50/5.66. All 16 key and
23 message states were captured at 1440, 1024 and 390 pixels, in both languages
and themes: 468 required captures. The 16 review sheets were visually inspected
without a clipping or structure defect. Evidence: tmp/interface-shots-result.json
and tmp/screens-interface-20261116-matrix/review/index.html. These are mock
visual checks; final landing gates remain separate.

The real vault UI runner passed 13 checks at 10:32:19 UTC on 2026-11-16 in
6.576 seconds, at start/end loads 7.92/7.87/6.35 and 7.28/7.74/6.31. It generated
a fresh local fixture account, protected it, locked/unlocked it, rejected wrong
passwords, downloaded the exact encrypted copy and re-imported the same account.
No event was published and no page error occurred. Browser and loopback servers
were closed. Evidence: tmp/vault-ui-report.json, tmp/vault-ui-final.log and
tmp/vault-ui-final-result.json. The tab assertion follows the originating guest
layout through its persistence debounce; a previously open reader Accounts tile
correctly survives sign-in. No product change was needed for that harness fix.
The built/review record belongs to interface-specs.md and the landing gates.
