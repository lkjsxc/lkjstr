# Nostr Protocol Tests

## Purpose

Offline vectors and generated adversarial regressions for the independent crate.
Run the [crate verifier](../README.md#verification) from the worktree root.

## Table of Contents

- [common/](common/): deterministic test keys, events, and signed invoice builders.
- [vectors/](vectors/): primary-source fixtures and provenance.

`bech32_limits.rs` checks long entities, signed route-hinted invoices, LNURLs,
and explicit boundaries. `bech32_rejection.rs` checks long-input checksum,
case, and padding rejection. Other Rust integration tests cover the modules
listed in the [crate API map](../README.md#api-map).
