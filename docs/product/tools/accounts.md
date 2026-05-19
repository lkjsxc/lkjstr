# Accounts

## Purpose

Accounts represent public identities and signing capability.

## Contract

- Read-only accounts store a public key and cannot publish.
- NIP-07 accounts are created from the browser signer public key.
- The active account is stored locally and is used by Tweet publishing.
- Tweet publishing requires an active NIP-07 account and a browser signer.
- Accounts can mine a CPU-only vanity `npub` prefix after `npub1`.
- Mining runs in a browser worker so the workspace remains interactive.
- Mining results show `npub` and `nsec` for export; `nsec` is not persisted.
- A mined public key may be added as a read-only account only after the user
  explicitly chooses that action.
- Mining progress includes attempts, attempts per second, elapsed time, and
  cancel state.
