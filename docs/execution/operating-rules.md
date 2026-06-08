# Execution Operating Rules

## Purpose

This file defines how an autonomous agent works when the product contract already
answers the decision. Status: implemented for workflow; product behavior still
lives in the linked docs.

## Core Rules

- Do not stop for a product decision already covered by
  [autonomous decision defaults](../decisions/autonomous-decision-defaults.md).
- Use the documented default when no human answer exists, then update the
  relevant docs, implementation, tests, and ledgers in the same change when the
  default changes product behavior.
- Do not use fake relay data, fake protocol results, fake metadata, fake upload
  URLs, fake passkey success, or placeholder success UI outside tests.
- Do not delete TypeScript or Svelte product code until Rust parity, focused
  tests, a ledger update, and no-import proof exist.
- Do not make unsupported browser security features silently degrade. Show an
  explicit unsupported state.
- Keep browser effects behind host adapters with explicit cleanup ownership.

## Default Routing

| Default | Canonical decision source | Execution rule |
| ------- | ------------------------- | -------------- |
| Delete SvelteKit product logic after real Rust parity. | [Autonomous defaults](../decisions/autonomous-decision-defaults.md) and [Rust/WASM client](../decisions/rust-wasm-client.md). | Remove only with real behavior, focused tests, ledger evidence, and no-import proof. |
| Boot the root route through Rust/WASM after shell and surface gates pass. | [Autonomous defaults](../decisions/autonomous-decision-defaults.md), [Rust/WASM client](../decisions/rust-wasm-client.md), and [browser-first runtime](../decisions/browser-first.md). | Keep the shipped root behavior until the Rust shell satisfies the workspace contract. |
| Keep local unprotected signer storage usable but visibly risky. | [Autonomous defaults](../decisions/autonomous-decision-defaults.md), [SQLite OPFS storage](../decisions/sqlite-opfs-storage.md), and [worker-owned storage](../decisions/worker-owned-storage.md). | Preserve explicit risk UI and never log or export secrets except by explicit user action. |
| Defer encrypted direct messages until storage, relay, signing, and feed foundations are complete. | [Autonomous defaults](../decisions/autonomous-decision-defaults.md) and [protocol kernel](../decisions/protocol-kernel.md). | Do not add fake message previews or make an unsupported DM path look available. |
| Keep NIP-29 separate from NIP-28 Public Chat. | [Autonomous defaults](../decisions/autonomous-decision-defaults.md) and [protocol kernel](../decisions/protocol-kernel.md). | NIP-29 uses relay-scoped groups; NIP-28 remains channel chat. |
| Show explicit unsupported states for browser security features. | [Autonomous defaults](../decisions/autonomous-decision-defaults.md) and [browser-first runtime](../decisions/browser-first.md). | Do not silently fall back from passkey, Web Crypto, WebAuthn, NIP-07, or storage security states. |
| Avoid fake relay data outside tests. | [Autonomous defaults](../decisions/autonomous-decision-defaults.md), [relay ownership](../decisions/relay-ownership.md), and [protocol kernel](../decisions/protocol-kernel.md). | Use synthetic relays and events only in tests; product UI renders real data or unavailable states. |

## Change Rule

When a default becomes product behavior, update the relevant product or
architecture doc first, implement the real behavior, add focused tests, update
the parity or deletion ledger, and record only verification that actually ran.
