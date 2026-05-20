# Accounts

## Purpose

Accounts represent public identities and signing capability.

## Contract

- Read-only accounts store a public key and cannot publish.
- NIP-07 accounts are created from the browser signer public key.
- Local signing accounts are created from a generated secret key or an imported
  `nsec` after explicit user action.
- Local account secret keys are stored separately from public account records.
- Account lists, workspace data, and UI props must never expose local key
  material.
- Local and NIP-07 accounts can sign and publish.
- Accounts have an `enabled` flag. Missing stored flags normalize to enabled.
- Disabled accounts remain on device but are ignored for active account,
  signing, upload auth, Home, Notifications, Profile Edit, and Tweet.
- The active account is stored locally and must be enabled to be used.
- Disabling or removing the active account selects the newest enabled account,
  or clears active state when none remain.
- Accounts supports one inline input for `npub`, hex pubkey, or `nsec`.
- Read-only account add, local `nsec` import, NIP-07 connect, local account
  creation, active selection, enablement, and removal report inline status.
- Account flows must not use browser prompt or alert dialogs.
- Tweet publishing requires an active signing account and enabled write relays.
- Accounts can mine a CPU-only vanity `npub` prefix after `npub1`.
- Mining runs in a browser worker so the workspace remains interactive.
- Mining results show `npub` and `nsec` for export; `nsec` is not persisted.
- A mined `nsec` may be added as a local signing account only after the user
  explicitly chooses that action.
- Mining progress includes attempts, attempts per second, elapsed time, and
  cancel state.
