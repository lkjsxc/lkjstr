# Passkey Storage

## Purpose

Passkey storage defines how WebAuthn-protected local Nostr secrets are kept.

## Contract

- Public account records contain no secret material.
- Passkey encrypted secrets live in `passkeyAccountSecrets`.
- Raw local signing secrets live in `localAccountSecrets`.
- A passkey secret record stores account id, pubkey, credential id, PRF salt
  input metadata, ciphertext, IV, creation time, and update time.
- PRF output is expanded with HKDF before AES-GCM encryption or decryption.
- Salt strings are stable product labels and do not include release shorthand.
- Memory fallback may preserve encrypted passkey records when IndexedDB is
  unavailable, but decrypted keys remain session-only.
- Removing an account deletes raw local secrets, passkey encrypted secrets, and
  passkey runtime session state.
