# Local Secret Security

## Purpose

This document records the design boundary for passkey-protected local signing
secrets.

## Current Contract

- Local signing secrets are stored only in the raw local secret table.
- Account listing APIs expose public account metadata, not private key material.
- NIP-07 signing remains outside local secret storage.
- Passkey-protected local secret storage is not implemented.
- No passkey secret table is part of the durable schema.

## Design Requirements

- Any passkey-backed secret store must require explicit user enrollment.
- Raw secret export must stay an explicit user action.
- The account list must not reveal whether a private key can be decrypted until
  a signing or reveal operation asks for it.
- Recovery and failure states must be visible without logging secrets.
- Storage migration must not silently move raw local secrets into a passkey
  path.
