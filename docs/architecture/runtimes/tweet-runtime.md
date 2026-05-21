# Tweet Runtime

## Purpose

Tweet runtime owns composer recovery and publish helpers.

## Contract

- `draft-store.ts` stores tab-scoped recovery snapshots in memory immediately
  and mirrors them to IndexedDB.
- `publish.ts` validates content, active signer account, and write
  relays.
- Signing uses the shared account signer resolver for local and NIP-07
  accounts.
- Signed events use kind `1`.
- Successful publish attempts cache the event locally.
- Relay publish results are surfaced to the tab.
