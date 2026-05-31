# Storage Ledger

## Purpose

This directory owns storage-level ledger resource manifests and dispatch helpers
for recoverable cache resources.

## Table of Contents

No child documents.

## Contract

- Every `CacheResourceKind` appears in `ledger-manifest.ts`.
- Target-state checks and direct delete dispatch consume the same manifest.
- Event-owned rows may still use specialized deletion for dependent rows.
- Repair scans stream rows with `table-scan.ts` instead of materializing whole
  object stores.
