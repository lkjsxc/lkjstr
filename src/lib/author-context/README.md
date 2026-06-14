# Author Context

## Purpose

This directory is kept as the local deletion-ledger anchor for retired
TypeScript Author Context helpers.

## Table of Contents

- [Contract](#contract)

## Contract

- Product Author Context loading is Rust-owned in `lkjstr-app` and `lkjstr-web`.
- The shipped tab wrapper in `src/lib/tabs/author-context` remains Svelte host
  glue until broader tab deletion proof exists.
- Event-row menu glue remains in shared Svelte event rows until shared Leptos
  event renderer parity and no-import proof exist.
