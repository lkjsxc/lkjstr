# SQLite OPFS

## Purpose

This directory contains the browser host glue for the OPFS-backed SQLite WASM
storage worker.

## Table of Contents

- `types.ts`: worker protocol value types.
- `database.ts`: official SQLite WASM database opening and SQL helpers.
- `worker-core.ts`: request handling independent of browser worker globals.
- `worker.ts`: dedicated module worker entry point.
- `client.ts`: owned browser client with deadlines, cancellation, and cleanup.

## Contract

The worker may load official SQLite WASM and execute Rust-provided statements.
It does not own product storage rules. The Rust storage crate owns schema,
statement meaning, data classes, and retention policy.
