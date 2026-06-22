# PUBLICCHAT-001 Real Public Chat Runtime

## Purpose

Replace the honest Rust empty Public Chat surface with real NIP-28 relay and storage behavior.

## Status

ready

## Current Evidence

- Rust protocol, domain reducer, app query planner, and honest UI empty states exist

## Next Edit

Wire the next real channel discovery or selected-channel message slice through Rust host providers.

## Files To Read

- docs/agent/skills/public-chat-runtime.md
- docs/product/feeds/public-chat.md
- docs/protocol/public-chat.md
- docs/architecture/runtimes/public-chat-runtime.md

## Files To Touch

- crates/lkjstr-app/src/public_chat/\*\*
- crates/lkjstr-ui/src/workspace/public_chat.rs
- crates/lkjstr-web/\*\*
- src/lib/public-chat/\*\*

## Focused Gate

```sh
pnpm test -- tests/unit/public-chat
cargo test -p lkjstr-protocol public_chat
cargo test -p lkjstr-app public_chat
cargo test -p lkjstr-relays
```

## Acceptance

Public Chat renders real channels or messages, or exact unavailable/partial states.

## Must Not

- Do not synthesize channels, messages, moderation, or publish success.
