# Memory And Retention

## Purpose

Bounded memory and retention contracts.

## Details

Read next: [architecture/data/heap-retention.md](../architecture/data/heap-retention.md),
[architecture/data/resource-ownership.md](../architecture/data/resource-ownership.md),
and [operations/memory-verification.md](../operations/memory-verification.md).

- Automated memory gates use focused cleanup tests, runtime counters, bounded
  collection tests, storage-operation settlement tests, and retention tests.
- Browser heap snapshots and long-session observations are manual diagnostics,
  not canonical automated gates.
- Relay diagnostic summaries are bounded in memory. Storage diagnostics avoid
  full old-store scans.
- Runtime-visible and open-reference cache pins are owner-scoped, bounded, and
  cleaned up on owner teardown.
- Cache pressure records protected data, prunable cache, unknown storage, and
  residual browser overhead separately. Rust Stats projects these fields from a
  real pressure snapshot row when one exists, otherwise it shows an explicit
  unavailable reason.
