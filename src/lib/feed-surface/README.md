# Feed Surface

## Purpose

Shared feed paging, near-end detection, speculative older prefetch, and staged
row helpers for timeline-like tabs.

## Contents

- [near-end.ts](near-end.ts): threshold helpers and observer margins.
- [paging-state.ts](paging-state.ts): footer phase reducer.
- [speculative-older.ts](speculative-older.ts): deduped older-page coordinator.
- [staged-rows.ts](staged-rows.ts): immediate row shell projection.

## Contract

Feed tabs import these helpers instead of duplicating near-end math. Virtual
lists remain in `EventTreeList`.
