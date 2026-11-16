# Encrypted local keys

## Purpose

Protocol 6 adds engine-only NIP-49 import, explicit encrypted backup, session
unlock and lock. No password dialog, visible string or new account surface is
included. Existing plaintext accounts continue working without migration.
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

Run status belongs in docs/status.md and the landing's gate record. Native
test code and this specification do not by themselves claim a browser run.

## Interface work still needed

Claude owns the import/password/unlock/lock and encrypted-backup surfaces, both
string tables, wrong-password recovery and session explanation. An explicit
existing-account migration flow can reuse encrypted export followed by verified
encrypted import; do not remove plaintext before a successful transaction.
A device/session policy for locking and stronger KDF choice also needs a written
interface specification. Nothing in this change claims all existing keys are
encrypted or automatically migrates them.
