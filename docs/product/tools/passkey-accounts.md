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
- Unlocking or logging in with a retained local encrypted record best-effort
  rewrites the credential largeBlob so older same-browser passkeys can become
  portable when the authenticator supports it.
- Login can read a discoverable credential largeBlob, store the recovered
  encrypted record locally, evaluate PRF for the selected credential id, and
  restore the account row.
- If a selected discoverable credential has no portable lkjstr data, login
  reports that the user must use the browser profile that created it, unlock a
  listed passkey account, or create a new passkey from nsec.
- Publishing from a locked passkey account fails before relay writes and before
  WebAuthn is invoked.
- Passkey accounts never expose an `nsec` reveal or copy control.
