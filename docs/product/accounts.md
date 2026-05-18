# Accounts

## Purpose

Accounts represent public identities and signing capability.

## Contract

- Read-only accounts store a public key and cannot publish.
- NIP-07 accounts are created from the browser signer public key.
- The active account is stored locally and is used by Tweet publishing.
- Tweet publishing requires an active NIP-07 account and a browser signer.
