# PUBLISH-001 Rust Publish Job Model

## Purpose

Move publish job semantics for Tweet, Profile Edit, and event actions into Rust.

## Status

ready

## Current Evidence

- publish surfaces remain partial
- protocol signing helpers exist

## Next Edit

Model one publish job path with event construction, signer denial, relay OK/error, retry, and storage evidence.

## Files To Read

- docs/agent/skills/publish-runtime.md
- docs/product/tools/tweet.md
- docs/product/tools/profile-edit.md
- docs/protocol/event-actions.md

## Files To Touch

- crates/lkjstr-protocol/**
- crates/lkjstr-app/**
- crates/lkjstr-storage/**
- crates/lkjstr-relays/**
- src/lib/tweet/**

## Focused Gate

```sh
pnpm test -- tests/unit/tweet tests/unit/protocol
cargo test -p lkjstr-protocol event
pnpm verify:quiet
```

## Acceptance

No UI claims publish success before real signer and relay evidence.

## Must Not

- Do not fake signing, relay OK, upload, or zap states.
