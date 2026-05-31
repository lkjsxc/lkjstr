# IndexedDB Bridge

## Purpose

This directory contains the Rust browser host adapter for IndexedDB.

## Table of Contents

- `callbacks.rs`: owned request callback slots.
- `database.rs`: database open and object store helpers.
- `mod.rs`: public IndexedDB module surface.
- `schema.rs`: manifest-driven object store and index creation.
- `settings_requests.rs`: settings request execution and decoding.
- `settings_store.rs`: settings override row `put`, `get`, `delete`, and list.
- `workspace_store.rs`: workspace `put`, `get`, and startup input loading.

The code here may call `web_sys` directly. Pure storage rules and row shapes
stay in `lkjstr-storage`.
