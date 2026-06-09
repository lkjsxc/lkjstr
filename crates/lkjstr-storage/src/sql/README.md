# SQL Storage Source

## Purpose

This directory contains executable SQLite schema records for the OPFS storage
target.

## Table of Contents

- `mod.rs`: public SQL schema, statement, hash, and shared record APIs.
- `protected.rs`: protected user-data and safety tables.
- `cache.rs`: event cache, feed evidence, notification, and job tables.
- `diagnostics.rs`: relay diagnostics and app log tables.
- `indexes.rs`: SQLite index records.
- `metadata.rs`: ledger and metadata tables.
- `repair_statements.rs`: repair physical target probe statements.
- `statements.rs`: protected repository SQL statement records.
