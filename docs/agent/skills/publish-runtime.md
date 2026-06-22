# Skill: Publish Runtime

## Purpose

Move Tweet, Profile Edit, replies, reactions, reposts, and related publish job
semantics into Rust/WASM while preserving explicit signing and per-relay truth.

## Trigger

Use when editing publish jobs, Tweet, Profile Edit, event actions, signing,
relay publish status, retries, drafts, or Rust protocol event construction.

## Read First

- [../../product/tools/tweet.md](../../product/tools/tweet.md).
- [../../product/tools/profile-edit.md](../../product/tools/profile-edit.md).
- [../../protocol/event-actions.md](../../protocol/event-actions.md).
- [../../architecture/runtimes/tweet-runtime.md](../../architecture/runtimes/tweet-runtime.md).
- [../../architecture/rust-wasm/protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md).

## Files Likely Touched

- `crates/lkjstr-protocol/` event construction and signing helpers.
- `crates/lkjstr-app/` publish job models.
- `crates/lkjstr-storage/` drafts and job rows.
- `crates/lkjstr-relays/` publish outcomes.
- `crates/lkjstr-ui/`, `crates/lkjstr-web/`, `src/lib/tweet/`, and tests.

## Procedure

1. Document the publish state before source changes.
2. Build events from real input and explicit account state.
3. Treat signing denial, signer absence, and read-only accounts as denied or unavailable.
4. Record relay OK/error per relay and only show success after real OK evidence.
5. Persist drafts and active jobs through protected repositories.

## Focused Gate

```sh
pnpm test -- tests/unit/tweet tests/unit/media tests/unit/protocol
cargo test -p lkjstr-protocol event
cargo test -p lkjstr-relays publish
pnpm verify:quiet
```

## Final Gate

Run Docker final gate before broad publish cutover or deletion claims.

## Must Not

- Do not fake publish, signing, upload, zap, or relay OK states.
- Do not log or expose local signing secrets.
- Do not publish without explicit user intent.

## Handoff

List event construction, signer path, per-relay outcomes, retry behavior,
draft/job persistence, and commands run.
