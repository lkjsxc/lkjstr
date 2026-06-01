# Request Budget Source Map

## Purpose

Map request-budget contracts to source modules. Each source module stays at or
below 200 lines.

## Modules

| Module                                             | Role                                 |
| -------------------------------------------------- | ------------------------------------ |
| `src/lib/relays/relay-info-types.ts`               | typed relay information records      |
| `src/lib/relays/relay-info-parse.ts`               | pure NIP-11 parsing                  |
| `src/lib/relays/relay-info-store.ts`               | bounded memory and IndexedDB storage |
| `src/lib/relays/relay-info-fetch.ts`               | HTTP endpoint conversion and fetch   |
| `src/lib/relays/relay-info.ts`                     | public facade                        |
| `src/lib/relays/relay-limits.ts`                   | typed relay limitation facade        |
| `src/lib/relays/request-budget/types.ts`           | request-budget types                 |
| `src/lib/relays/request-budget/policy.ts`          | app hard caps and surface policy     |
| `src/lib/relays/request-budget/nip11.ts`           | NIP-11 limitation conversion         |
| `src/lib/relays/request-budget/message-size.ts`    | `REQ` byte estimation                |
| `src/lib/relays/request-budget/derive.ts`          | pure budget derivation               |
| `src/lib/relays/request-budget/apply.ts`           | filter and read-option application   |
| `crates/lkjstr-relays/src/request_budget/types.rs` | Rust request-budget contract types   |
| `crates/lkjstr-relays/src/request_budget/policy.rs` | Rust app caps and intent policy     |
| `crates/lkjstr-relays/src/request_budget/derive.rs` | Rust pure budget derivation         |
| `crates/lkjstr-relays/src/request_budget/apply.rs` | Rust filter and read-cap helpers     |
| `crates/lkjstr-relays/src/request_message_size.rs` | Rust `REQ` byte cap decision         |
| `src/lib/events/relay-page-limits.ts`              | thin compatibility wrapper only      |
| `src/lib/relays/orchestration/page-reads.ts`       | budgeted page-read entry point       |
| `src/lib/relays/subscription-manager-keys.ts`      | effective dedupe keys                |
| `src/lib/relays/subscription-read-page.ts`         | budgeted read execution              |

## Tests

| Path                                               | Role                                                 |
| -------------------------------------------------- | ---------------------------------------------------- |
| `tests/unit/relays/relay-info.test.ts`             | NIP-11 parse, fetch, and store gates                 |
| `tests/unit/relays/request-budget/`                | pure budget derivation gates                         |
| `crates/lkjstr-relays/tests/request_budget_test.rs` | Rust request-budget derivation gates                 |
| `crates/lkjstr-relays/tests/request_message_size_test.rs` | Rust `REQ` byte cap gates                  |
| `tests/unit/relays/subscription-manager-*.test.ts` | dedupe and cap behavior                              |
| `tests/unit/events/relay-page-*.test.ts`           | grouped page limit behavior                          |
| `tests/e2e/`                                       | Relay Settings, Stats, Search, and Custom Request UX |
