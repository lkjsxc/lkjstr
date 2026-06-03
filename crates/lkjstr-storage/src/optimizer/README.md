# Optimizer Storage

## Purpose

Optimizer storage contains recoverable relay measurement, score, scan-hint, and
route-evidence rows for the SQLite worker target. Rows are real diagnostics and
performance inputs; they are never coverage proof.

## Table of Contents

- `relay_observation_row.rs`: per-read observation row codec.
- `relay_score_row.rs`: aggregate relay read score row codec.
- `scan_hint_row.rs`: expanded scan hint row codec and key guard.
- `route_evidence_row.rs`: measured route evidence row codec.
- `repository.rs`: repository statement identifiers and table list.
- `retention.rs`: retention and repair planning helpers.
- `tests.rs`: row, retention, inventory, and repair tests.
