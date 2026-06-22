# Rust Cutover Focused Gates

## Purpose

This file owns task-id focused gates for Rust/WASM cutover work.

## Gates

## Rust First Cutover Task Gates

Use this table when a task id appears in the Rust/WASM cutover plan. Run the
listed focused gate before the repository and Docker gates.

| Task    | Focused gate                                                                             |
| ------- | ---------------------------------------------------------------------------------------- |
| D-001   | `cargo run -p lkjstr-xtask -- check-docs` and `cargo run -p lkjstr-xtask -- check-lines` |
| D-002   | Docs checks plus `pnpm check:repo`                                                       |
| D-003   | Docs checks plus local Markdown link checks through `pnpm check:repo`                    |
| S-001   | `cargo test -p lkjstr-storage` and `cargo test -p lkjstr-web storage`                    |
| S-002   | `cargo test -p lkjstr-storage event_cache` and storage repository tests                  |
| S-003   | `cargo test -p lkjstr-storage feed_cache` and `cargo test -p lkjstr-app cache_display`   |
| S-004   | Storage And Cache plus `cargo test -p lkjstr-storage retention` when the module exists   |
| R-001   | Rust Relay Host and `cargo test -p lkjstr-relays client ingress`                         |
| R-002   | Relay Paging plus `cargo test -p lkjstr-relays page_read request_budget`                 |
| R-003   | Subscription Orchestration plus progressive read reducer tests                           |
| F-001   | Feed Regression plus `cargo test -p lkjstr-app feed`                                     |
| F-002   | Feed Regression plus UI component or browser tests for the changed Leptos feed rows      |
| F-003   | Feed Regression and Subscription Orchestration Home checks                               |
| F-004   | Relay Paging plus selected-relay Global checks                                           |
| F-005   | Profile focused tests and shared feed runtime tests                                      |
| F-006   | Thread exact-read tests and shared event-display tests                                   |
| F-007   | Notification filters, paging, window, and reference hydration tests                      |
| Q-001   | Search query tests plus Rust app or storage search tests                                 |
| Q-002   | Custom Request parse/read tests plus relay routing tests                                 |
| P-001   | Publish job Rust tests plus relay publish tests                                          |
| P-002   | Tweet draft, signer, upload, and publish queue tests                                     |
| P-003   | Profile Edit publish tests plus event cache update tests                                 |
| P-004   | Public Chat reducer, NIP-28 routing, publish, and cleanup tests                          |
| SEC-001 | Local secret, WebAuthn/Web Crypto host-boundary, migration, and redaction tests          |
| SEC-002 | Diagnostics redaction grep tests, unit redaction tests, and UI log tests                 |
| NIP-001 | Client-tag protocol tests and every changed write-surface publish test                   |
| NIP-002 | NIP-29 protocol, route, storage, relay, and UI tests                                     |
| DM-001  | NIP-17, NIP-44, NIP-59 envelope, relay, storage, and unavailable-state tests             |
| UX-001  | Workspace startup, split, resize, drag, snapshot, and fallback tests                     |
| UX-002  | Focused test for each changed tool plus Stats diagnostics tests                          |
| CUT-001 | `pnpm check:repo`, no-import `rg`, and `cargo run -p lkjstr-xtask -- check-lines`        |
| CUT-002 | Root Response, `pnpm cloudflare:quiet`, Docker app-smoke                                 |
