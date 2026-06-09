# Storage Command Source

## Purpose

This directory contains typed storage command metadata for SQLite worker
repositories.

## Table of Contents

- `mod.rs`: public command exports and command list.
- `spec.rs`: shared command metadata shape and enums.
- `active_account.rs`: active-account selector command specs.
- `app_log.rs`: durable app-log command specs.
- `diagnostics.rs`: relay diagnostics, route, and notification command specs.
- `events.rs`: cached-event command specs.
- `feed_cache.rs`: feed cursor, coverage, and scan-hint command specs.
- `inventory.rs`: inventory-only Stats command spec.
- `jobs.rs`: durable job command specs.
- `optimizer.rs`: scan-model optimizer command specs.
- `pressure.rs`: storage pressure command specs.
- `protected.rs`: protected storage command specs.
- `repair.rs`: repair scan, probe, backfill, and inventory report specs.
- `retention.rs`: retention planner and delete-dispatch command specs.
- `search.rs`: tag lookup and local Search token-index command specs.
