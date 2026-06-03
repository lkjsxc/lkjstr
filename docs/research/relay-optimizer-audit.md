# Relay Optimizer Audit

## Purpose

This note records the current docs-to-implementation audit for relay scoring,
route evidence, adaptive scan learning, and Stats visibility.

## Baseline Commands

- `pnpm install`: passed; dependencies were already current.
- `pnpm check:repo`: passed.
- `pnpm test:quiet`: passed.
- `pnpm rust-wasm:quiet`: failed before Rust tests because
  `docker-compose.verify.yml` is missing.
- `cargo run -p lkjstr-xtask -- check-docs`: failed with the same missing
  `docker-compose.verify.yml` path.

## Findings

- Docs already require cache-first correctness to come only from complete
  interval-union coverage. Dense, incomplete, failed, compacted, stale, and
  missing rows are not proof.
- Docs already require adaptive grouped scans for Home, Global, Profile posts,
  Notifications, and safe Custom Request event-list reads, but the optimizer
  contract is split across relay-page, coverage, and orchestration pages.
- TypeScript currently owns relay read scoring in `src/lib/relays`; the model is
  bounded in memory and uses a simple score key that correctly excludes tab and
  pane ids.
- Rust route planning already keeps selected fallback relays, excludes disabled
  relays, and accepts score hints for ordering, but measured route trust and
  persisted optimizer inputs are not yet Rust-owned.
- Stats has a strong product contract, but optimizer state needs a dedicated
  projection so agents can see whether scan hints are used, rejected, expired,
  or unavailable.

## Next Documentation Slice

Add a relay optimizer subtree under `docs/architecture/network/` and link it
from network, orchestration, data, Stats, and Rust/WASM ledgers before changing
implementation.
