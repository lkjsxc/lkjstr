# SQLite OPFS Import Export

## Purpose

This file defines explicit user-driven import and export. Status: design-only;
the current worker envelope does not expose import or export operations.

## Boundary

Import and export are user commands, not silent startup migration. The app does
not move local signing secrets into a new protection mechanism without an
explicit user action and a documented storage contract.

Current local signing secrets remain raw local secret payloads in
`local_account_secrets` under the existing raw-secret contract. Passkey
protected storage is not implemented.

## Export

Export will use a typed request with user-selected data classes:

- protected user data.
- recoverable cache.
- diagnostics.
- app log.

The UI must label whether local signing secrets are included. Secret export is
off unless the user selects it explicitly.

## Import

Import will use a typed request. The importer validates schema metadata, data
classes, row shapes, event identities, relay URLs, signer kinds, and ledger
records before writing.

Protected data conflicts require a visible user choice. Recoverable cache can be
merged by canonical ids and updated timestamps.

## Repair And Reset

Corrupt SQLite storage returns `Corrupt`. Repair or reset is an explicit command
with visible consequences. The app may recover to a usable Welcome workspace,
but it must not silently claim durable state was preserved when it was not.

