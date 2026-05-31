# Local Secrets

## Purpose

Local secret storage keeps signing secrets separate from public account records
and defines what is not implemented.

## Contract

`accounts` stores public account metadata. `localAccountSecrets` stores raw
local signing material for accounts that use the browser signer boundary.

Account listing APIs return public metadata only. Signing code reads local
secrets through the account and signer boundary, not through general Settings,
Stats, logs, workspace snapshots, or debug exports.

## Protection

Local secrets are protected user data. Cache pressure, ledger repair, and
diagnostic cleanup cannot delete them.

## Passkey Boundary

Passkey-protected local secret storage is not implemented. Do not restore a
passkey secret table until the product flow, security model, repository API,
schema step, diagnostics, and tests are complete.
