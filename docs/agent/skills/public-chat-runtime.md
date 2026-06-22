# Skill: Public Chat Runtime

## Purpose

Replace honest empty Public Chat states with real NIP-28 channel, message,
moderation, publish, partial relay, and cleanup behavior when the product
contract requires it.

## Trigger

Use when editing Public Chat docs, `src/lib/public-chat`, Public Chat tabs,
NIP-28 protocol code, or Rust Public Chat app/UI/Web paths.

## Read First

- [../../product/feeds/public-chat.md](../../product/feeds/public-chat.md).
- [../../protocol/public-chat.md](../../protocol/public-chat.md).
- [../../architecture/runtimes/public-chat-runtime.md](../../architecture/runtimes/public-chat-runtime.md).
- [../../architecture/rust-wasm/cutover/parity-ledger.md](../../architecture/rust-wasm/cutover/parity-ledger.md).
- [../../architecture/rust-wasm/cutover/deletion-ledger.md](../../architecture/rust-wasm/cutover/deletion-ledger.md).

## Files Likely Touched

- `crates/lkjstr-protocol/` NIP-28 helpers.
- `crates/lkjstr-app/src/public_chat*`.
- `crates/lkjstr-relays/`, `crates/lkjstr-storage/`, `crates/lkjstr-ui/`, and `crates/lkjstr-web/`.
- `src/lib/public-chat/`, `src/lib/tabs/public-chat/`, and tests.

## Procedure

1. Align product and protocol docs first.
2. Parse and render only real NIP-28 events or explicit unavailable states.
3. Keep selected relays, disabled-relay exclusion, and partial failures diagnostic.
4. Model create/edit/hide/mute/publish with real event and relay outcomes.
5. Add cleanup tests before browser wiring is considered complete.

## Focused Gate

```sh
pnpm test -- tests/unit/public-chat
cargo test -p lkjstr-protocol public_chat
cargo test -p lkjstr-app public_chat
cargo test -p lkjstr-relays
pnpm rust-wasm:quiet
```

## Final Gate

Run Docker final gate before claiming Public Chat parity or deletion.

## Must Not

- Do not synthesize channels, messages, moderation rows, or publish success.
- Do not show empty state from cache miss alone.
- Do not implement raw kind `29` groups as NIP-28 or NIP-29 chat.

## Handoff

List protocol rows, relay/storage proof, publish states, cleanup proof, and any
retained TypeScript paths.
