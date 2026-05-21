# Passkey Accounts

## Purpose

Passkey accounts define the user-facing contract for WebAuthn-protected local
Nostr keys.

## Contract

- A passkey account is still a local Nostr key account.
- The browser passkey unlocks encrypted Nostr secret material; the passkey does
  not sign Nostr events.
- Account creation requires a valid `nsec`, real WebAuthn PRF output, and
  required largeBlob support before any account is saved.
- Unsupported PRF, missing authenticator output, or canceled ceremonies surface
  inline errors and do not create a degraded account.
- Encrypted secret material is stored in the passkey secret store and mirrored
  into the credential largeBlob for portable login.
- Decrypted secret material is held in memory only and is cleared by lock,
  disconnect, reload, or browser process loss. Disconnect keeps encrypted
  passkey material for future passkey login.
- A reloaded passkey account starts locked.
- Unlock uses stored credential ids through `allowCredentials` and PRF
  `evalByCredential`.
- Login can read a discoverable credential largeBlob, store the recovered
  encrypted record locally, evaluate PRF for the selected credential id, and
  restore the account row.
- Publishing from a locked passkey account fails before relay writes and before
  WebAuthn is invoked.
- Passkey accounts never expose an `nsec` reveal or copy control.
