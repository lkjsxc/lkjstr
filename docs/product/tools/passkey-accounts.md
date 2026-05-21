# Passkey Accounts

## Purpose

Passkey accounts define the user-facing contract for WebAuthn-protected local
Nostr keys.

## Contract

- A passkey account is still a local Nostr key account.
- The browser passkey unlocks encrypted Nostr secret material; the passkey does
  not sign Nostr events.
- Account creation and import require real WebAuthn PRF output before any
  account is saved.
- Unsupported PRF, missing authenticator output, or canceled ceremonies surface
  inline errors and do not create a degraded account.
- Encrypted secret material is stored in the passkey secret store only.
- Decrypted secret material is held in memory only and is cleared by lock,
  account removal, reload, or browser process loss.
- A reloaded passkey account starts locked.
- Unlock and login use stored credential ids through `allowCredentials`.
- The app does not offer a discoverable-only passkey login path.
- Publishing from a locked passkey account fails before relay writes and before
  WebAuthn is invoked.
- Passkey accounts never expose an `nsec` reveal or copy control.
