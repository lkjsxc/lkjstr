# Storage Schema

## Purpose

This directory owns the executable table manifest and generated Dexie schema
shape for browser-owned storage.

## Table of Contents

No child documents.

## Contract

- `table-manifest.ts` is the source for live IndexedDB table names.
- `dexie-schema.ts` turns the manifest into Dexie `stores()` input.
- Inventory and docs checks consume manifest-derived names and groups.
