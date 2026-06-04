# Relay Optimizer Verification

## Purpose

This file lists the checks that prove optimizer docs, reducers, storage,
bridges, Stats rows, and synthetic relay scenarios.

## Documentation Gates

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

If a gate fails because a local tool shim points at a missing file, record the
failure exactly and do not claim it passed.

## Rust Unit Gates

```sh
cargo test -p lkjstr-relays
cargo test -p lkjstr-app -- feed_scan
cargo test -p lkjstr-storage -- optimizer
cargo clippy --workspace --all-targets -- -D warnings
```

## Browser And WASM Gates

```sh
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm test:e2e:quiet -- scan
pnpm test:e2e:quiet -- stats
```

Unit tests must cover the TypeScript host boundary without requiring a real
storage worker: Exact route-fingerprint matching, parent-scope matching,
deterministic scope ordering, DTO mapping, Rust/WASM unavailable state, latest
decision debug projection, and trace redaction.

## Scan Learning Scenarios

- dense limit-hit scan converges toward two thirds occupancy, not simple halves
- sparse complete scan grows from density and may grow beyond two times, capped
  by the configured change factor
- one-count sparse scan with prior span `600` caps at `2400` under defaults
- missing exact model with parent evidence uses the parent, not neutral
- stale exact model blends with or loses to fresh parent evidence
- incomplete windows raise failure and incomplete rates without proving absence
- closing and reopening keeps learned span when SQLite storage is available
- disabled relays are excluded before optimizer scoring and scan planning
- scan hints never prove cache absence or suppress uncovered relays

## Storage Scenarios

- exact scan density model round-trips
- parent scan density model round-trips
- model keys reject tab and pane identifiers
- retention deletes optimizer rows only
- repair reports orphan optimizer ledger rows
- selecting models returns exact and parent scopes in deterministic order
- stale rows are returned with decayed confidence instead of being omitted when
  no better parent exists

## Synthetic Relay Scenarios

- fast relay paints first
- slow relay inserts later in canonical order
- failed relay does not block reachable relays
- NIP-65-only route does not suppress selected fallback
- measured route outranks stale weak route evidence
- Stats shows optimizer evidence or explicit unavailable state

## Final Gate

Docker Compose remains the final gate: validate Compose config, build `app`,
`verify`, `e2e`, `cloudflare`, and `app-smoke`, then run those verification
services from the built images.
