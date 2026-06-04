# Storage Schema

## Purpose

This directory owns the executable table manifest for browser-owned storage
families and inventory groups.

## Table of Contents

No child documents.

## Contract

- `table-manifest.ts` is the source for live logical storage families.
- Inventory and docs checks consume manifest-derived names and groups.
- SQLite table names are mapped by typed SQLite repositories.
