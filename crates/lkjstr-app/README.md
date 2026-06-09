# lkjstr App

## Purpose

This crate owns pure browser-local application composition before host adapters
and UI components call into it.

## Table of Contents

- [src/](src/): app composition source.
- [tests/](tests/): app composition tests.

## Ownership Index

- Owned meaning: startup recovery, demand planning, route planning, feed
  reducers, feed windows, hydration planning, jobs, and product view models.
- Forbidden meaning: direct browser APIs, raw SQLite, raw WebSocket objects,
  Svelte stores, and DOM measurement effects.
- Effect boundary: pure commands and view models; `lkjstr-web` executes host
  effects and reports measurements or worker outcomes.
- Main tests: `cargo test -p lkjstr-app` plus focused filters such as `-- feed`
  and `-- home`.
- Next cutover task: produce one Home feed view model from Rust storage evidence
  and relay snapshots.
