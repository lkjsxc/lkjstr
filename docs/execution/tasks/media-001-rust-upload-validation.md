# MEDIA-001 Rust Upload Validation

## Purpose

Move media provider validation and NIP-98 upload auth helpers into Rust commands.

## Status

ready

## Current Evidence

- Blossom and NIP-96 behavior exists in TypeScript
- Rust protocol helpers are partial

## Next Edit

Move one validation/auth helper to Rust and keep insertion gated on real upload success.

## Files To Read

- docs/agent/skills/media-upload.md
- docs/protocol/media-upload.md
- docs/product/tools/upload-settings.md

## Files To Touch

- crates/lkjstr-protocol/**
- crates/lkjstr-web/**
- src/lib/media/**
- tests/unit/media/**

## Focused Gate

```sh
pnpm test -- tests/unit/media
cargo test -p lkjstr-protocol upload
pnpm verify:quiet
```

## Acceptance

Upload success requires real provider response and descriptor validation.

## Must Not

- Do not fake upload success or silently switch providers.
