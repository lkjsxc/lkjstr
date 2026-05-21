# Accounts

## Purpose

Accounts represent public identities and signing capability.

## Contract

- Read-only accounts store a public key and cannot publish.
- NIP-07 accounts are created from the browser signer public key.
- Local signing accounts are created from a generated secret key or an imported
  `nsec` after explicit user action.
- Passkey local accounts are created from an explicit `nsec`, then encrypted
  with WebAuthn PRF material from a stored browser credential.
- Local account secret keys are stored separately from public account records.
- Passkey account secret keys are stored only as encrypted records separate
  from public account records and raw local secret records.
- Account lists, workspace data, and UI props must never expose local key
  material.
- Local, NIP-07, and passkey local accounts are signing accounts. Passkey local
  accounts can publish only after explicit unlock in the current browser
  session.
- A locked passkey account reports `Unlock the active passkey account before
publishing.` and publishing must not trigger WebAuthn implicitly.
- Account records always normalize to `enabled: true`. The UI has no
  enable/disable control; disabling is treated as account retirement and is not
  exposed.
- Removing the active account selects the newest remaining account or clears
  active state when none remain.
- Accounts supports one inline input for `npub`, hex pubkey, or `nsec`.
- Read-only account add, local `nsec` import, NIP-07 connect, local account
  creation, active selection, disconnect, and local secret reveal report inline
  status.
- Generate nsec, create passkey from nsec, stored-account unlock, lock, and
  login report inline status.
- Local signing accounts can reveal or copy their `nsec` only after an inline
  user action. Read-only and NIP-07 accounts never expose local secret controls.
- Passkey local accounts do not reveal or copy decrypted `nsec`.
- Login with passkey uses retained local passkey records when present and can
  restore a disconnected or fresh-browser account from discoverable largeBlob
  data.
- Unsupported WebAuthn PRF or missing PRF output surfaces an honest inline
  error. The app must not create a fake fallback passkey account.
- Account flows must not use browser prompt or alert dialogs.
- Tweet publishing requires an active signing account and enabled write relays.
- Accounts can mine a CPU-only vanity `npub` prefix after `npub1`.
- Mining runs in a browser worker so the workspace remains interactive.
- Mining results show `npub` and `nsec` for export; `nsec` is not persisted.
- A mined `nsec` may be added as a local signing account only after the user
  explicitly chooses that action.
- Mining progress includes attempts, attempts per second, elapsed time, and
  cancel state.
