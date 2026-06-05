# Security

## Purpose

Security docs define local key handling, signer boundaries, content safety, and
relay trust rules for a browser-only Nostr workspace.

## Table of Contents

- [local-keys.md](local-keys.md): local nsec, NIP-07, Web Crypto, export, and
  reset rules.
- [content-safety.md](content-safety.md): safe rendering, links, media, logs,
  and relay payload trust.

## Contracts

- Private keys never appear in logs, normal exports, relay payloads, diagnostic
  rows, or UI state outside explicit reveal/export flows.
- Read-only accounts cannot sign or publish.
- NIP-07 signatures are requested only for explicit user actions that require a
  signer.
- Relay events and media responses are untrusted input and never render as raw
  HTML.
- Security-sensitive storage changes update
  [../current-state.md](../current-state.md) and the relevant product docs.

## Source Map

- `src/lib/accounts/`: account records, local secret access, NIP-07, and signer
  boundaries.
- `src/lib/protocol/`: event, NIP-19, NIP-98, media, zap, and tag parsers.
- `src/lib/components/events/`: safe event rendering surfaces.
- `src/lib/storage/sqlite-opfs/`: local secret and account repository glue.
- `crates/lkjstr-protocol`: Rust protocol validation and signing helpers.
- `crates/lkjstr-storage`: local secret and protected-table contracts.

## Verification

- `pnpm check:repo`
- `pnpm test -- tests/unit/accounts tests/unit/protocol tests/unit/media`
- `cargo test -p lkjstr-protocol`
- `cargo test -p lkjstr-storage`

## Maintenance Notes

Any new signing, upload, import, export, or reset flow must add a focused test
that proves private material is not logged or exported by default.
