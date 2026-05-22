# Tweet Runtime

## Purpose

Tweet runtime owns composer recovery and publish helpers.

## Contract

- `draft-store.ts` stores tab-scoped recovery snapshots in memory immediately
  and mirrors them to IndexedDB.
- `publish.ts` validates content, active signer account, and write relays.
- Signing uses the shared account signer resolver for local and NIP-07
  accounts.
- Signed events use kind `1`.
- Successful signing caches the event locally and starts relay publishing.
- The composer receives the signed event and delivery promise immediately,
  clears/focuses after local queueing, and surfaces only late all-relay
  rejection or delivery failure diagnostics.
