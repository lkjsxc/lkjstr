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
- [scan-model-records.ts](scan-model-records.ts): scan density repository types.
- [scan-model-repository.ts](scan-model-repository.ts): SQLite scan model rows.
- [scan-model-debug.ts](scan-model-debug.ts): redacted scan optimizer debug rows.
- [scan-model-wasm.ts](scan-model-wasm.ts): narrow WASM bridge wrapper.

## Contract

Feed tabs import these helpers instead of duplicating near-end math. Virtual
lists remain in `EventTreeList`.
