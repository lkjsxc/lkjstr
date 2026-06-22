# Verification Ledger

## Purpose

This ledger maps Rust-first cutover areas to focused checks and the final Docker
Compose gate. Use it with [implementation-ledger.md](implementation-ledger.md)
before claiming parity or deleting TypeScript and Svelte product code.

## Gate Rule

A focused gate proves the edited slice. The final gate proves the repository
artifact. Do not mark a row ready unless the named focused checks pass after the
change and Docker Compose verification is either run or recorded as not run.

## Focused Checks By Area

| Area                            | Focused checks                                                                                                                                                                                                                                   | Final gate                           | Notes                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| Documentation contracts         | `pnpm check:repo`                                                                                                                                                                                                                                | `docker compose run --rm verify`     | Run before implementation when docs changed.                            |
| Protocol kernels                | `cargo test -p lkjstr-protocol`, `pnpm test -- tests/unit/protocol`                                                                                                                                                                              | `docker compose run --rm verify`     | Product paths must not use fake protocol results.                       |
| Storage manifest and row codecs | `cargo test -p lkjstr-storage`, `pnpm test -- tests/unit/storage`                                                                                                                                                                                | `docker compose run --rm verify`     | Protected records and cache records need separate proof.                |
| SQLite worker host              | `pnpm test -- tests/unit/storage/sqlite-opfs-worker.test.ts`, `wasm-pack test --headless --chrome crates/lkjstr-web -- storage`                                                                                                                  | `docker compose run --rm verify`     | Worker fallback must produce visible memory-mode diagnostics.           |
| Accounts and local secrets      | `pnpm test -- tests/unit/accounts`, `cargo test -p lkjstr-storage -- local_secret`                                                                                                                                                               | `docker compose run --rm verify`     | Private material must be redacted outside explicit export.              |
| Relay runtime                   | `cargo test -p lkjstr-relays`, `pnpm test -- tests/unit/relays`                                                                                                                                                                                  | `docker compose run --rm verify`     | Include cancellation, malformed ingress, and budget denial.             |
| Relay WebSocket host            | `wasm-pack test --headless --chrome crates/lkjstr-web -- relay`, `pnpm test -- tests/unit/relays/relay-client.test.ts`                                                                                                                           | `docker compose run --rm verify`     | Browser effects stay behind typed adapters.                             |
| Feed runtime                    | `cargo test -p lkjstr-app -- feed`, `pnpm test -- tests/unit/events tests/unit/feed-surface`                                                                                                                                                     | `docker compose run --rm verify`     | Cache miss is not proof of absence.                                     |
| Home and Global                 | `pnpm test -- tests/unit/timeline`, `cargo test -p lkjstr-app -- feed`                                                                                                                                                                           | `docker compose run --rm verify`     | Home requires follow-list ownership proof; Global uses selected relays. |
| Profile and Author Context      | `pnpm test -- tests/unit/profile tests/unit/identity`, `cargo test -p lkjstr-app -- profile`                                                                                                                                                     | `docker compose run --rm verify`     | Follow count and sparse scans must expose unknown and partial states.   |
| Thread                          | `pnpm test -- tests/unit/thread tests/unit/events`, `cargo test -p lkjstr-protocol -- tags`                                                                                                                                                      | `docker compose run --rm verify`     | Missing parents use compact unavailable state.                          |
| Notifications                   | `pnpm test -- tests/unit/notifications`, `cargo test -p lkjstr-app -- notification`                                                                                                                                                              | `docker compose run --rm verify`     | Account switching and bounded older windows are required.               |
| Search                          | `pnpm test -- tests/unit/search`, `cargo test -p lkjstr-app -- search`, `wasm-pack test --headless --chrome crates/lkjstr-web --test search_feed_tab_test`, `wasm-pack test --headless --chrome crates/lkjstr-web --test search_feed_relay_test` | `docker compose run --rm verify`     | Broader parity and deletion proof remain open.                          |
| Custom Request                  | `pnpm test -- tests/unit/custom-request`, `cargo test -p lkjstr-app -- custom_request`                                                                                                                                                           | `docker compose run --rm verify`     | Validation errors must be exact.                                        |
| Tweet and Profile Edit publish  | `pnpm test -- tests/unit/tweet tests/unit/media tests/unit/protocol`, `cargo test -p lkjstr-protocol -- event`                                                                                                                                   | `docker compose run --rm verify`     | Signing must follow explicit user intent.                               |
| Upload settings and media       | `pnpm test -- tests/unit/media`, `cargo test -p lkjstr-protocol -- upload`                                                                                                                                                                       | `docker compose run --rm verify`     | Insert media URL only after a real upload success.                      |
| Stats and lkjstr Log            | `pnpm test -- tests/unit/log tests/unit/storage tests/unit/relays`, `cargo test -p lkjstr-storage -- stats`                                                                                                                                      | `docker compose run --rm verify`     | Durable logs are bounded and redacted.                                  |
| Public Chat                     | `pnpm test -- tests/unit/public-chat`, `cargo test -p lkjstr-domain -- public_chat`                                                                                                                                                              | `docker compose run --rm verify`     | NIP-28 data must come from real events or test-only fixtures.           |
| Workspace and UI shell          | `pnpm check`, `pnpm test -- tests/unit/workspace`, `cargo test -p lkjstr-ui`                                                                                                                                                                     | `docker compose run --rm verify`     | Svelte may stay view-only until Leptos parity.                          |
| Cloudflare static hosting       | `pnpm cloudflare:quiet`                                                                                                                                                                                                                          | `docker compose run --rm cloudflare` | Cloudflare remains static hosting only.                                 |
| App smoke                       | `pnpm verify:quiet`                                                                                                                                                                                                                              | `docker compose run --rm app-smoke`  | Proves nonblank root workspace response.                                |

## Current Run Notes

Detailed 2026-06-13 run notes moved to
[verification-run-notes-2026-06-13.md](verification-run-notes-2026-06-13.md).
Keep new run evidence in the table below unless a narrative note is required.

## Recent Focused Evidence

Latest focused note: on 2026-06-22, RUSTWASM-TOOLCHAIN-001 made Rust/WASM
preflight deterministic and product-safe. Missing `wasm-pack`, Chrome, or
Firefox now fails `pnpm rust-wasm:quiet` with install or Docker instructions,
while Timeline/feed Rust islands, retained bridge tabs, feed-surface loaders,
generic runtime error text, follow-graph, and Stats diagnostics map raw
toolchain errors to explicit bridge-unavailable text.
Focused Vitest, xtask toolchain, `cargo test -p lkjstr-web`,
`cargo test -p lkjstr-app -- feed`, `cargo fmt --check`, workspace clippy,
repo/docs/line checks, `pnpm test:quiet`, `pnpm verify:quiet`,
`pnpm cloudflare:quiet`, and Docker config/build/verify/cloudflare/app-smoke
passed. Host-local `pnpm rust-wasm:quiet` now fails early because Firefox is
not installed on the host; Docker remains the successful full toolchain proof.

Previous focused note: on 2026-06-22, Rust Public Chat state text names exact
blockers for relay selection, channel/message loading, incomplete coverage,
composer availability, publish status, and moderated messages without rendering
hidden content. Public Chat route planning also excludes disabled selected
relays and disabled metadata hint relays, and Rust Public Chat builders now use
the shared demand surface for channel, metadata, selected-message, and own
moderation reads; TypeScript orchestration also recognizes `public-chat` and
filters live ingress to NIP-28 kinds, and TypeScript Public Chat plans carry
exact relay request purposes. `cargo fmt --check`, `cargo test -p lkjstr-ui public_chat`,
`cargo test -p lkjstr-app --test public_chat_queries_test`,
`cargo test -p lkjstr-app --test public_chat_demand_test`,
`cargo test -p lkjstr-relays --test ingress_test`,
`cargo test -p lkjstr-app --test feed_runtime_lifecycle_test`,
`pnpm test -- tests/unit/relays/orchestration/ingress-classify.test.ts`,
`pnpm test -- tests/unit/public-chat/public-chat-filters.test.ts`,
`pnpm check:repo`, docs, line guards, and `cargo clippy -p lkjstr-app --all-targets -- -D warnings`
passed. `pnpm rust-wasm:quiet` now reaches the browser harness but still fails
because geckodriver exits with SIGKILL and the runner returns HTTP 500. Earlier
`wasm-pack test --headless --chrome crates/lkjstr-web --test public_chat_scroll_test`
compiled but failed in the browser harness because ChromeDriver exited with
SIGKILL and the runner returned HTTP 404. Docker was not rerun for this slice.

Previous focused note: on 2026-06-20, retained mention/reaction/media/metadata/avatar
Svelte chrome uses shared snippets. Focused tests, ESLint, formatting, Svelte
check, repo/docs/line guards, whitespace, and quiet verify passed. Targeted
Followees/Profile WASM tests passed; broad quiet exceeded 900s. Docker was not rerun.

Previous focused note: on 2026-06-18, the Home anchor browser proofs and Docker
final gate passed; the detailed command list is recorded below.

Previous focused note: on 2026-06-17, workspace feed island ownership proof
passed the targeted repo-guard and host-selection Vitest files, Prettier,
ESLint, `pnpm check:repo`, `pnpm test:quiet`, docs and line checks, and
`git diff --check`. The proof covers generic Rust island host selection,
hidden-tab empty mount keys, account-scoped and target-scoped remount keys,
exact mounter dispatch, and a persistent `check:repo` guard that rejects
retained Svelte feed tab body imports or mounts from product source, excluding
the retained target files themselves. The same guard also rejects product-source
imports or mounts of retained TimelineTab support files.

Previous focused note: on 2026-06-17, the shipped Rust User Timeline provider
target-posts-only fallback passed `cargo fmt --check`,
`cargo check -p lkjstr-web --target wasm32-unknown-unknown`,
`cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings`,
`cargo test -p lkjstr-app -- user_timeline`, `cargo test -p lkjstr-ui user_timeline`,
`wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_target_only_test`,
`wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_retry_test`,
`wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_provider_test`,
`PATH=$HOME/.local/bin:$PATH corepack pnpm check:repo`,
`cargo run -p lkjstr-xtask -- check-docs`, `cargo run -p lkjstr-xtask -- check-lines`, and `git diff --check`.
The proof keeps real cached target-authored rows after selected-relay follow-list
discovery exhausts without kind `3`, renders the target-posts-only notice,
preserves relay diagnostics, and keeps existing User Timeline cache/coverage and
retry behavior. Canonical Rust/WASM quiet and Docker final-gate proof are
recorded below; User Timeline no-import proof remains open.
2026-06-18 feed-surface Stats diagnostics proof: focused Vitest covered
row-height anchor delta, stale observation, width-bucket, visible-fragment, and
oversized semantic-row counters; `pnpm check:repo`, `pnpm test:quiet`,
`pnpm verify:quiet`, docs, line, and whitespace guards passed with the existing
Node engine warning. Docker final gate was not rerun for this focused proof.
2026-06-19 retained Svelte event helper proof:
ESLint/Vitest/UI leases: tree-list 8/29; UI older 23; custom request 14; search 13; followees 13; user timeline 7; rust-wasm ok.

The full recent evidence table is split by row group:

- [verification-ledger-surface-runs.md](verification-ledger-surface-runs.md): recent surface and helper focused runs.
- [verification-ledger-feed-storage-runs.md](verification-ledger-feed-storage-runs.md): feed, storage, and final-gate focused runs.
