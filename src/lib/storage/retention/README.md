# Storage Retention

## Purpose

This directory owns cache-pressure policy that decides what browser-owned
records are safe to delete.

## Table of Contents

No child documents.

## Contract

- Protection scans return an explicit completion status.
- Cache compaction must delete fewer rows when protection evidence is partial.
- Retention code may read IndexedDB through storage-owned helpers while cache
  compatibility barrels still exist during the storage migration.
