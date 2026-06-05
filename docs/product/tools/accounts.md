# Accounts

## Purpose

Accounts represent public identities and signing capability.

## Contract

- Read-only accounts store a public key and cannot publish.
- NIP-07 accounts are created from the browser signer public key.
- Local signing accounts are created from a generated secret key or an imported
  `nsec` after explicit user action.
- Local account secret keys are stored separately from public account records.
- Local account records and local signing secrets are browser-owned SQLite
  worker data when Workers are available. Event-cache cleanup never deletes
  them.
- Accounts shows protected-data safety copy only. It does not expose a special
  browser storage prompt; durable protection is owned by the SQLite worker,
  manifest, and retention policy.
- Account lists, workspace data, and UI props must never expose local key
  material.
- Local and NIP-07 accounts are signing accounts. Read-only accounts cannot
  sign or publish.
- Account records always normalize to `enabled: true`. The UI has no
  enable/disable control; disabling is treated as account retirement and is not
  exposed.
- Stored account records with unsupported signer types are ignored during reads.
- Removing the active account selects the newest remaining account or clears
  active state when none remain.
- Accounts supports one inline input for `npub`, hex pubkey, or `nsec`.
- Read-only account add, local `nsec` import, NIP-07 login, active selection,
  disconnect, and local secret reveal report inline status.
- Generate nsec reports inline status and only fills the account input.
- The Accounts tab does not expose a one-click local-account creation button.
  Generated local signing accounts are created only when the filled `nsec` is
  explicitly added.
- Local signing accounts can reveal or copy their `nsec` only after an inline
  user action. Read-only and NIP-07 accounts never expose local secret controls.
- Account flows must not use browser prompt or alert dialogs.
- Tweet publishing requires an active signing account and enabled write relays.
- Accounts can mine a CPU-only vanity `npub` prefix after `npub1`.
- Mining runs in a browser worker so the workspace remains interactive.
- Mining results show `npub` and `nsec` for export; `nsec` is not persisted.
- A mined `nsec` may be added as a local signing account only after the user
  explicitly chooses that action.
- Mining progress includes attempts, attempts per second, elapsed time, and
  cancel state.

## Rust Conversion Status

- The Rust/WASM shell renders a partial Accounts surface from real account and
  local secret rows.
- Rust Accounts supports read-only account add, local `nsec` import, generated
  `nsec` fill, active selection, disconnect, and explicit local secret reveal.
- Rust Accounts connects NIP-07 by calling the browser `window.nostr`
  `getPublicKey` method, validates the returned public key, stores a signing
  account, and makes it active.
- Rust Accounts and the TypeScript surface intentionally do not expose browser
  storage prompt controls.
