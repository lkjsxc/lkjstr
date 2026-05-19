# Tweet Runtime

## Purpose

Tweet runtime owns draft persistence and publish helpers.

## Contract

- `draft-store.ts` stores durable drafts in IndexedDB.
- `publish.ts` validates content, active account, NIP-07 signer, and write
  relays.
- Signed events use kind `1`.
- Successful publish attempts cache the event locally.
- Relay publish results are surfaced to the tab.
