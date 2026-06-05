# Local Keys

## Purpose

This contract defines how local signing secrets, NIP-07 accounts, read-only
accounts, export, reset, and browser storage risk are handled.

## Current Behavior

- Read-only accounts store only a public key and cannot sign.
- NIP-07 accounts store a public key and ask `window.nostr.signEvent` only when
  a write action needs a signature.
- Local accounts are created from a generated or imported `nsec` only after an
  explicit user action.
- Local account secret rows are stored separately from public account rows.
- Local secrets are protected from cache deletion by the storage manifest.
- Inline reveal and copy actions are explicit and never automatic.

## Invariants

- Private keys are never sent to relays, media providers, zap endpoints, or
  diagnostics.
- Private keys are never included in normal non-secret export.
- Secret reveal requires an explicit action in the Accounts surface.
- Removing or resetting storage must state that local signing secrets are lost.
- Browser-local encryption cannot protect against a compromised app runtime;
  docs and UI must not imply otherwise.

## Web Crypto Strategy

Passkey-protected local secret storage is design-only. A real encrypted store
must use Web Crypto with explicit enrollment, visible unsupported states, and a
clear recovery story before it can replace raw local secret rows.

## Failure Behavior

- Missing local secret rows make local signing unavailable and show an inline
  error.
- NIP-07 rejection is a user-cancelled signing failure, not a storage failure.
- Read-only accounts report that publishing requires a signing account.
- Storage reset clears local secrets only after user confirmation.

## Source Map

- `src/lib/accounts/local-secret-store.ts`: local secret access.
- `src/lib/accounts/signer.ts`: signer resolution and read-only rejection.
- `src/lib/tabs/accounts/`: account UI, reveal, copy, and import flows.
- `src/lib/storage/repositories/secrets-store.ts`: repository boundary.
- `crates/lkjstr-storage/src/local_secrets.rs`: Rust storage contract.
- `docs/architecture/data/storage/kernel/local-secrets.md`: storage kernel
  rules.

## Acceptance Checks

- `pnpm test -- tests/unit/accounts`
- `pnpm test -- tests/unit/storage`
- `cargo test -p lkjstr-storage local_secret`
