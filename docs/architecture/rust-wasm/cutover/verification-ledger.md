# Verification Ledger

## Purpose

Maps Rust-first cutover focused checks and Docker final gate. Use [implementation-ledger.md](implementation-ledger.md) before parity or deletion claims.

## Gate Rule

A focused gate proves the edited slice. The final gate proves the repository
artifact. Do not mark a row ready unless the named focused checks pass after the
change and Docker Compose verification is either run or recorded as not run.

## Recent Evidence

2026-07-01 notifications/publish proof: empty Notifications windows keep older-read evidence; Tweet exits storage/signer/archive failures. Docker not rerun.
2026-07-01 post-display startup policy proof: surface policy,
Notifications/Profile degraded-read tests, focused post-display gate, wasm
compile, touched-crate clippy, repo/docs/line/fmt checks, matching Vitest
suites, and Docker config/build/verify/cloudflare/app-smoke passed.

2026-06-30 post-display repair proof: startup diagnostics, relay socket
hardening, shared footer visibility, Home follow discovery, Profile about links,
and Notifications heart reactions passed focused gates, quiet gates, Cloudflare,
and Docker final gate (`config`, `build`, `run verify`, `run cloudflare`,
`run app-smoke`).

2026-06-30 storage broker/startup proof: shared broker callers preserve exact
failure labels, Stats/Log show startup probes, and page active-account pubkeys
can bridge Rust island account-read failures with diagnostics. Focused storage,
repo, docs, line, fmt, clippy, Rust/WASM, test, and verify gates passed.

2026-06-29 public/protected feed availability proof passed focused tests, quiet
gates, and Docker final gate.

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

## Recent Focused Evidence

Latest focused note: on 2026-07-01, Home cache-unavailable follow-list lookup
stays diagnostic and performs relay discovery; a synthetic relay browser test
proves real note recovery. Rust/WASM and retained TypeScript relay clients
avoid app-owned `CONNECTING` closes and gate wire frames on `OPEN`. Passed app
read-availability tests, lkjstr-web cargo gates, wasm Chrome Home/socket/lib
filters, exact Vitest, fmt, clippy, workspace tests, `check:repo`,
`test:quiet`, `rust-wasm:quiet`, `verify:quiet`, `cloudflare:quiet`, and
Docker config/build/verify/cloudflare/app-smoke.

Previous focused note: on 2026-06-29, User Timeline fallback retention,
protected account states, pagehide close, holder diagnostics, and shared feed
policy passed focused app/web/storage tests, docs/line/repo checks,
`rust-wasm:quiet`, `verify:quiet`, and Docker final gate (`config`, `build`, `run verify`, `run cloudflare`, `run app-smoke`).

Previous focused note: on 2026-06-29, OPFS owner recovery, public read relay
fallback, Search/User Timeline relay dispatch, and privacy consent UI passed
`pnpm check:repo`, `pnpm check`, focused Vitest privacy/storage suites,
`cargo test -p lkjstr-app -- search`, `cargo test -p lkjstr-app -- user_timeline`,
`cargo clippy -p lkjstr-web --all-targets -- -D warnings`, `pnpm test:quiet`,
`pnpm rust-wasm:quiet`, `pnpm verify:quiet`, `pnpm cloudflare:quiet`, and the
Docker final gate (`config`, `build`, `run verify`, `run cloudflare`,
`run app-smoke`).

Previous focused note: on 2026-06-29, SQLite OPFS origin-owner hardening added
an exclusive `lkjstr.sqlite-opfs-owner` Web Lock before persistent dedicated
worker construction, mapped owner denial and SAH-pool `NoModificationAllowedError`
to busy/unavailable outcomes with cooldown, and kept protected repositories from
rendering empty fallback rows after owner collision. Focused proof passed:
`pnpm test tests/unit/storage`, `cargo test -p lkjstr-storage`,
`cargo test -p lkjstr-web`, `cargo test -p lkjstr-web storage_worker`,
`cargo test -p lkjstr-web sqlite_host_store`, `pnpm test tests/unit/cache
tests/unit/events/repository.test.ts`, `pnpm test
tests/unit/feed-surface/scan-model-repository.test.ts`, `cargo run -p
lkjstr-xtask -- check-storage-manifest-docs`, `cargo fmt --check`,
`cargo clippy -p lkjstr-web --all-targets -- -D warnings`, `pnpm check:repo`,
`pnpm check`, `pnpm test:quiet`, `pnpm rust-wasm:quiet`,
`pnpm verify:quiet`, and `pnpm cloudflare:quiet`. Docker final gate was not
rerun for this non-deletion storage-owner slice.

Previous focused note: on 2026-06-29, SQLite OPFS owner hardening serialized
static worker commands, made SAH pool install single-flight with 64 file slots,
preserved idempotent open and shared Rust store ownership, and kept browser e2e
suspended from quiet and Docker gates. Focused Vitest, `cargo test -p
lkjstr-web`, `cargo test -p lkjstr-storage`, repo/docs/line/style checks,
`pnpm test:quiet`, `pnpm rust-wasm:quiet`, `pnpm verify:quiet`,
`pnpm cloudflare:quiet`, and Docker config/build/verify/cloudflare/app-smoke
passed.

Previous focused note: on 2026-06-27, CLOUDFLARE-WASM-PRODUCTION-REPAIR moved
bridge generation to `pnpm rust-wasm:build`, made the Vite plugin asset-only,
added Workers Builds toolchain bootstrap, moved bridge signing off
`secp256k1-sys` so hosted WASM builds do not need `clang`, added bridge asset
verification, and made app smoke fetch the manifest, JavaScript asset, and WASM
bytes.
`pnpm test -- tests/unit/rust-wasm`, `pnpm check:repo`,
`LKJSTR_BOOTSTRAP_WASM_TOOLCHAIN=1 pnpm cloudflare:install-wasm-toolchain`,
`CC=definitely-missing-clang CARGO_TARGET_DIR=target/k256-wasm-test3 pnpm rust-wasm:build`,
`cargo test -p lkjstr-protocol --test crypto_test`, `pnpm rust-wasm:build`,
`pnpm build`, `pnpm verify:wasm-assets`, `pnpm cloudflare:dry-run:built`, app
smoke, `cargo test -p lkjstr-xtask toolchain`, `pnpm test:quiet`,
`pnpm verify:quiet`, `pnpm cloudflare:quiet`, `cargo test --workspace --quiet`,
Docker config, Docker build for app/verify/cloudflare/app-smoke, Docker verify,
Docker cloudflare, and Docker app-smoke passed. Host `pnpm rust-wasm:quiet`
timed out at 300s; Docker verify remains the successful full toolchain proof.

Previous focused note: on 2026-06-22, RUSTWASM-TOOLCHAIN-001 made Rust/WASM
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
The full recent evidence table is split by row group:

- [verification-ledger-surface-runs.md](verification-ledger-surface-runs.md): recent surface and helper focused runs.
- [verification-ledger-feed-storage-runs.md](verification-ledger-feed-storage-runs.md): feed, storage, and final-gate focused runs.
