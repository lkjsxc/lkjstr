# Feed Surface Tests

## Purpose

Unit tests for shared feed paging helpers.

## Table of Contents

- [paging-state.test.ts](paging-state.test.ts): footer phase reducer.
- [older-prefetch.test.ts](older-prefetch.test.ts): safe prefetch gates.
- [speculative-older.test.ts](speculative-older.test.ts): older-page coordinator.
- [feed-geometry-features.test.ts](feed-geometry-features.test.ts): visible geometry content.
- [feed-measured-row-source.test.ts](feed-measured-row-source.test.ts): reserved wrapper measurement guard.
- [feed-fragment-diagnostics.test.ts](feed-fragment-diagnostics.test.ts): visible
  fragment and oversized-row counters.
- [row-height-diagnostics.test.ts](row-height-diagnostics.test.ts): anchor,
  stale-observation, and width-bucket counters.
- [row-height-reservation-keys.test.ts](row-height-reservation-keys.test.ts):
  width buckets and materialization-tier keying.
