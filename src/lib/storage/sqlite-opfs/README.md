# SQLite OPFS

## Purpose

This directory contains browser host glue for the worker-owned SQLite WASM
storage target.

## Table of Contents

- `types.ts`: worker protocol value types.
- `database.ts`: official SQLite WASM database opening and SQL helpers.
- `worker-core.ts`: request handling independent of worker globals.
- `worker.ts`: dedicated module worker entry point.
- `client.ts`: browser client with deadlines, cancellation, and cleanup.

## Contract

The worker may load official SQLite WASM and execute storage-owned statements.
Product modules must call typed repositories instead of formatting SQL. New code
uses factories and plain data only.
