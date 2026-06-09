# SQLite Store Source

## Purpose

This directory contains Rust repository calls over the SQLite storage worker.

## Table of Contents

- `accounts.rs`: account and local-secret protected repository calls.
- `active_account.rs`: active-account selector repository calls.
- `database.rs`: worker-backed database handle, health, and statement dispatch.
- `inventory.rs`: SQLite table counts, health, and pressure rows for Rust Stats.
- `mod.rs`: public exports.
- `params.rs`: SQL parameter helpers.
- `pressure.rs`: storage pressure snapshot repository calls.
- `relay_sets.rs`: relay-set protected repository calls and bounded bulk save.
- `retention.rs`: retention delete dispatch adapter and worker batch binding.
- `rows.rs`: SQLite row decoding helpers.
- `settings.rs`: settings protected repository calls.
- `tab_states.rs`: tab-state and ledger repository calls.
- `tweet_drafts.rs`: Tweet draft protected repository calls.
- `workspaces.rs`: workspace protected repository calls.

## Contract

SQL text and row codecs stay in `lkjstr-storage`. This layer only binds
parameters, sends worker operations, and decodes typed rows.
