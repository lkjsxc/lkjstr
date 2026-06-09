# Storage Diagnostics

## Purpose

Storage diagnostics explain what browser storage contains, why pressure remains,
and which verification proves storage behavior.

## Table of Contents

- [inventory.md](inventory.md): SQLite-first and browser storage inventory.
- [pressure-states.md](pressure-states.md): cache pressure labels.
- [stats.md](stats.md): Stats UI projection.
- [verification.md](verification.md): required checks.

## Agent Start

- Current source owner: TypeScript Stats/cache diagnostics plus Rust pressure
  rows and partial Rust Stats projection.
- Desired Rust owner: `lkjstr-storage` inventory and Stats models,
  `lkjstr-web` inventory/pressure adapters, and `lkjstr-ui` Stats rendering.
- Next source edit: finish retention worker failure proof, then add repair and
  pressure inventory fields to `crates/lkjstr-storage/src/stats.rs`.
- Focused tests: `cargo test -p lkjstr-storage pressure`,
  `cargo test -p lkjstr-storage stats`, and `cargo test -p lkjstr-ui stats`.
- Ledgers: storage cutover area and verification ledger after proof only.
- Keep: TypeScript Stats, cache inventory, pressure, and old-store presence
  helpers until Rust Stats parity and no-import proof.

## Contract

Diagnostics may be partial, but they must be explicit. A timeout, unavailable
store, unsupported API, or incomplete inventory is reported as such. Partial
byte counts are useful only when paired with status and reason. Unknown old
or unowned storage is a visible inventory class. Only the remaining positive
gap after enumeration is residual browser overhead.
