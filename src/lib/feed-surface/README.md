# Feed Surface

## Purpose

Shared feed paging, near-end detection, speculative older prefetch, and staged
row helpers for timeline-like tabs.

## Table of Contents

- [near-end.ts](near-end.ts): threshold helpers and observer margins.
- [paging-state.ts](paging-state.ts): footer phase reducer.
- [older-prefetch.ts](older-prefetch.ts): safe Home/Global prefetch predicate.
- [speculative-older.ts](speculative-older.ts): deduped older-page coordinator.
- [staged-rows.ts](staged-rows.ts): immediate row shell projection.
- [feed-geometry-features.ts](feed-geometry-features.ts): content-aware row features.
- [feed-geometry-wasm.ts](feed-geometry-wasm.ts): temporary WASM bridge wrapper.
- [feed-visual-fragments.ts](feed-visual-fragments.ts): oversized event visual rows.
- [feed-visual-fragment-text.ts](feed-visual-fragment-text.ts): Unicode-safe text segmentation.
- [row-height-reservation.ts](row-height-reservation.ts): session measured row heights.
- [scan-model-records.ts](scan-model-records.ts): scan density repository types.
- [scan-model-keys.ts](scan-model-keys.ts): scope keys and parent contexts.
- [scan-model-dto.ts](scan-model-dto.ts): Rust/WASM scan DTO mapping.
- [scan-model-bridge.ts](scan-model-bridge.ts): async Rust/WASM scan planner calls.
- [scan-model-bridge-validation.ts](scan-model-bridge-validation.ts): typed bridge
  input failure states.
- [scan-model-proposal.ts](scan-model-proposal.ts): fallback density span proposal helper.
- [scan-model-observation.ts](scan-model-observation.ts): fallback model update helper.
- [scan-model-repository.ts](scan-model-repository.ts): SQLite scan model rows.
- [scan-model-repository-match.ts](scan-model-repository-match.ts): pure model
  scope matching.
- [scan-model-debug.ts](scan-model-debug.ts): redacted scan optimizer debug rows.
- [scan-model-wasm.ts](scan-model-wasm.ts): narrow WASM bridge wrapper.
- [virtual-lkjstr-web-wasm.d.ts](virtual-lkjstr-web-wasm.d.ts): virtual module type.

## Contract

Feed tabs import these helpers instead of duplicating near-end math. Virtual
lists remain in `EventTreeList`.
