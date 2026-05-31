# Cache

## Purpose

This directory contains cache status, ledger retention, and compaction helpers.
It is treated as a storage-internal compatibility area while ledger and
retention modules move under `src/lib/storage/`.

## Table of Contents

- Cache summary reads for the Stats tab.
- Shared `cacheLedger` record, scoring, byte accounting, selection, and deletion
  policies.
- Site storage target derivation from browser quota estimates.
