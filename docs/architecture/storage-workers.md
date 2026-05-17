# Storage And Workers

Owner: Architecture
State: Canon

## IndexedDB Role

IndexedDB is the durable local source for browser-owned state. It enables offline reading, refresh recovery, and fast deck restoration.

## Stores

- `events`: normalized events keyed by id.
- `event_relays`: relay evidence keyed by event id and relay URL.
- `profiles`: profile metadata by pubkey.
- `relay_sets`: named relay set definitions.
- `relays`: relay records and health snapshots.
- `accounts`: account metadata and signer capability.
- `drafts`: composer drafts by draft id.
- `deck_layouts`: tile positions, type, and configuration.
- `operation_log`: recent publish and relay outcomes for diagnostics.

Private key material, when supported locally, must be stored separately from account metadata and guarded by explicit user consent.

## Cache Rules

- Writes are idempotent by natural key.
- Event writes merge relay evidence rather than replacing records blindly.
- Query APIs return stable shapes that the UI can render while live updates continue.
- Storage errors are typed and surfaced to operations state.
- Cache schema changes must include migration notes in decision docs.

## Worker Role

Workers handle expensive or bursty work:

- event signature verification.
- event normalization batches.
- filter result indexing.
- timeline query fan-out.
- cache compaction.
- import and export processing.

## Worker Contract

Worker messages use typed envelopes:

- `request_id`.
- `type`.
- `payload`.
- `created_at`.

Worker responses include:

- `request_id`.
- `ok`.
- `payload` or `error`.
- `duration_ms`.

Workers must not receive private keys unless the selected signing mode explicitly requires a worker signer. The default signing path keeps private key use in the account service boundary.
