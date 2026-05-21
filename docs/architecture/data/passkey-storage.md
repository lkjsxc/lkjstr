# Passkey Storage

## Purpose

Passkey storage defines how WebAuthn-protected local Nostr secrets are kept.

## Contract

- Public account records contain no secret material.
- Passkey encrypted secrets live in `passkeyAccountSecrets`.
- Raw local signing secrets live in `localAccountSecrets`.
- A passkey secret record stores account id, pubkey, credential id, PRF salt
  input metadata, ciphertext, IV, creation time, and update time.
- New portable passkeys are discoverable WebAuthn credentials with user
  verification required, PRF output required, and largeBlob support required.
- The portable blob stores `app`, `format`, `accountId`, `pubkey`,
  `saltLabel`, `ciphertext`, `iv`, `createdAt`, and `updatedAt`. `format` is
  the stable string `lkjstr-passkey-secret`.
- PRF output is expanded with HKDF before AES-GCM encryption or decryption.
- Known-credential unlock requests use PRF `evalByCredential` and fail when
  PRF output is missing.
- Salt strings are stable product labels and do not include release shorthand.
- Memory fallback may preserve encrypted passkey records when IndexedDB is
  unavailable, but decrypted keys remain session-only.
- Removing an account deletes raw local secrets and locks passkey runtime
  session state. Encrypted passkey records are retained and there is no exposed
  destructive key-material deletion control.
