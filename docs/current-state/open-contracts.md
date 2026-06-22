# Open Contracts

## Purpose

Open contracts and follow-up product boundaries.

## Details

- Autonomous implementation defaults live in [decisions/autonomous-decision-defaults.md](../decisions/autonomous-decision-defaults.md).
- SQLite worker storage is the active durable-storage contract. Product modules must use typed repositories and must not add direct browser database access.
- Followees and User Timeline are active product contracts. They must render real
  NIP-02 data or explicit unavailable states and must not synthesize users or
  posts. A local cache miss triggers relay discovery and never proves absence.
- NIP-89 client tags are opt-in and must be added before signing only when a
  valid handler coordinate and relay hint exist.
- NIP-29 groups must use relay plus group id, `h` tags, relay-scoped state, and
  real relay data; do not implement raw kind `29`.
- Passkey-protected local secret storage is a follow-up product contract: it
  must actually encrypt local signer secrets with Web Crypto and WebAuthn PRF
  when supported, and show an unsupported state when the browser cannot do so.
- Encrypted direct messages are a follow-up product contract. The forward path
  is NIP-17 with NIP-44 and NIP-59; do not add fake message previews or make
  NIP-04 the primary new feature.
- Wallet custody is out of scope; zap support opens or copies invoices only.
- Broad runtime instrumentation remains limited to explicit runtime counters,
  compact memory counters, storage diagnostics, recoverable optimizer and
  orchestration traces, and persisted job records.
- Remote NIP-50 results depend on actual relay support.
- Blossom/NIP-B7 upload is the preferred media target. Configured Blossom
  uploads use raw blob transport, scoped signed auth, and descriptor-hash
  validation. NIP-96 remains a compatibility provider path.
- RSS remains diagnostic-only for memory verification; app JavaScript heap is
  the owned browser memory assertion when manually measured.
