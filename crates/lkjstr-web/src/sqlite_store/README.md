# SQLite Store Source

## Purpose

This directory contains Rust repository calls over the SQLite storage worker.

## Table of Contents

- `accounts.rs`: account and local-secret protected repository calls.
- `database.rs`: worker-backed database handle and statement dispatch.
- `mod.rs`: public exports.
- `params.rs`: SQL parameter helpers.
- `relay_sets.rs`: relay-set protected repository calls and bounded bulk save.
- `rows.rs`: SQLite row decoding helpers.
- `settings.rs`: settings protected repository calls.
- `tab_states.rs`: tab-state and ledger repository calls.
- `tweet_drafts.rs`: Tweet draft protected repository calls.
- `workspaces.rs`: workspace protected repository calls.

## Contract

SQL text and row codecs stay in `lkjstr-storage`. This layer only binds
parameters, sends worker operations, and decodes typed rows.
