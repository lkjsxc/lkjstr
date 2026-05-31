# Storage

## Purpose

This directory contains browser database, schema, inventory, and safe storage
adapters.

## Table of Contents

- `schema/`: executable storage table manifest and generated Dexie schema.
- `operation/`: typed storage results, deadlines, tracking, and transactions.
- IndexedDB binding and storage fallback wrappers.
- Storage inventory estimates for Stats diagnostics.
- `cacheLedger` shared retention ledger integration.
- `tabStates` snapshot persistence.

## Contract

The manifest in `schema/` is the source for live table names, Dexie schema
strings, and inventory groups. Feature code should move toward repository
functions instead of direct table access.
