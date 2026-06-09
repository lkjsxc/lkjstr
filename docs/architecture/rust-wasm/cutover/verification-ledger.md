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

| Area                            | Focused checks                                                                                                                  | Final gate                           | Notes                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| Documentation contracts         | `pnpm check:repo`                                                                                                               | `docker compose run --rm verify`     | Run before implementation when docs changed.                            |
| Protocol kernels                | `cargo test -p lkjstr-protocol`, `pnpm test -- tests/unit/protocol`                                                             | `docker compose run --rm verify`     | Product paths must not use fake protocol results.                       |
| Storage manifest and row codecs | `cargo test -p lkjstr-storage`, `pnpm test -- tests/unit/storage`                                                               | `docker compose run --rm verify`     | Protected records and cache records need separate proof.                |
| SQLite worker host              | `pnpm test -- tests/unit/storage/sqlite-opfs-worker.test.ts`, `wasm-pack test --headless --chrome crates/lkjstr-web -- storage` | `docker compose run --rm verify`     | Worker fallback must produce visible memory-mode diagnostics.           |
| Accounts and local secrets      | `pnpm test -- tests/unit/accounts`, `cargo test -p lkjstr-storage -- local_secret`                                              | `docker compose run --rm verify`     | Private material must be redacted outside explicit export.              |
| Relay runtime                   | `cargo test -p lkjstr-relays`, `pnpm test -- tests/unit/relays`                                                                 | `docker compose run --rm verify`     | Include cancellation, malformed ingress, and budget denial.             |
| Relay WebSocket host            | `wasm-pack test --headless --chrome crates/lkjstr-web -- relay`, `pnpm test -- tests/unit/relays/relay-client.test.ts`          | `docker compose run --rm verify`     | Browser effects stay behind typed adapters.                             |
| Feed runtime                    | `cargo test -p lkjstr-app -- feed`, `pnpm test -- tests/unit/events tests/unit/feed-surface`                                    | `docker compose run --rm verify`     | Cache miss is not proof of absence.                                     |
| Home and Global                 | `pnpm test -- tests/unit/timeline`, `cargo test -p lkjstr-app -- feed`                                                          | `docker compose run --rm verify`     | Home requires follow-list ownership proof; Global uses selected relays. |
| Profile and Author Context      | `pnpm test -- tests/unit/profile tests/unit/identity`, `cargo test -p lkjstr-app -- profile`                                    | `docker compose run --rm verify`     | Follow count and sparse scans must expose unknown and partial states.   |
| Thread                          | `pnpm test -- tests/unit/thread tests/unit/events`, `cargo test -p lkjstr-protocol -- tags`                                     | `docker compose run --rm verify`     | Missing parents use compact unavailable state.                          |
| Notifications                   | `pnpm test -- tests/unit/notifications`, `cargo test -p lkjstr-app -- notification`                                             | `docker compose run --rm verify`     | Account switching and bounded older windows are required.               |
| Search                          | `pnpm test -- tests/unit/search tests/unit/storage/sqlite-opfs-events.test.ts`, `cargo test -p lkjstr-app -- search`            | `docker compose run --rm verify`     | Local token index and relay NIP-50 merge both need coverage.            |
| Custom Request                  | `pnpm test -- tests/unit/custom-request`, `cargo test -p lkjstr-app -- custom_request`                                          | `docker compose run --rm verify`     | Validation errors must be exact.                                        |
| Tweet and Profile Edit publish  | `pnpm test -- tests/unit/tweet tests/unit/media tests/unit/protocol`, `cargo test -p lkjstr-protocol -- event`                  | `docker compose run --rm verify`     | Signing must follow explicit user intent.                               |
| Upload settings and media       | `pnpm test -- tests/unit/media`, `cargo test -p lkjstr-protocol -- upload`                                                      | `docker compose run --rm verify`     | Insert media URL only after a real upload success.                      |
| Stats and lkjstr Log            | `pnpm test -- tests/unit/log tests/unit/storage tests/unit/relays`, `cargo test -p lkjstr-storage -- stats`                     | `docker compose run --rm verify`     | Durable logs are bounded and redacted.                                  |
| Public Chat                     | `pnpm test -- tests/unit/public-chat`, `cargo test -p lkjstr-domain -- public_chat`                                             | `docker compose run --rm verify`     | NIP-28 data must come from real events or test-only fixtures.           |
| Workspace and UI shell          | `pnpm check`, `pnpm test -- tests/unit/workspace`, `cargo test -p lkjstr-ui`                                                    | `docker compose run --rm verify`     | Svelte may stay view-only until Leptos parity.                          |
| Cloudflare static hosting       | `pnpm cloudflare:quiet`                                                                                                         | `docker compose run --rm cloudflare` | Cloudflare remains static hosting only.                                 |
| App smoke                       | `pnpm verify:quiet`                                                                                                             | `docker compose run --rm app-smoke`  | Proves nonblank root workspace response.                                |

## Recent Focused Evidence

| Date | Area | Commands | Result | Final gate |
| --- | --- | --- | --- | --- |
| 2026-06-09 | Documentation contract cleanup | `pnpm check:repo`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines` | passed | not run |
| 2026-06-09 | Retention delete dispatch adapter | `pnpm check:repo`; `/home/lkjsxc/.cargo/bin/cargo fmt --check`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage retention`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage commands`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web retention`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web cache_ledger`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-storage-manifest-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-rust-style`; `pnpm rust-wasm:quiet` | focused cargo and docs passed; `pnpm rust-wasm:quiet` failed in wasm-pack Chrome on `accounts_active_selector_test` with HTTP 404 and chromedriver SIGKILL after clippy passed | not run |
| 2026-06-09 | Retention planner and command metadata | `/home/lkjsxc/.cargo/bin/cargo fmt --check`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage commands`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage retention`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-storage-manifest-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-rust-style`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`; `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm check:repo` | passed | not run |
| 2026-06-09 | Optimizer storage command metadata | `PATH="$HOME/.cargo/bin:$PATH" cargo fmt --check`; `PATH="$HOME/.cargo/bin:$PATH" cargo test -p lkjstr-storage commands`; `PATH="$HOME/.cargo/bin:$PATH" cargo test -p lkjstr-storage optimizer`; `PATH="$HOME/.cargo/bin:$PATH" cargo test -p lkjstr-storage`; `PATH="$HOME/.cargo/bin:$PATH" cargo run -p lkjstr-xtask -- check-storage-manifest-docs`; `PATH="$HOME/.cargo/bin:$PATH" cargo run -p lkjstr-xtask -- check-rust-style`; `pnpm check:repo`; `PATH="$HOME/.cargo/bin:$PATH" cargo run -p lkjstr-xtask -- check-docs`; `PATH="$HOME/.cargo/bin:$PATH" cargo run -p lkjstr-xtask -- check-lines` | passed | not run |
| 2026-06-09 | Storage command metadata coverage | `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`; `pnpm check:repo`; `/home/lkjsxc/.cargo/bin/cargo fmt --check`; `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-storage --all-targets -- -D warnings`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage commands`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage event_cache`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage feed_cache`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage diagnostics`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web storage`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-storage-manifest-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-rust-style`; `pnpm rust-wasm:quiet` | passed | not run |
| 2026-06-09 | Storage command spec shape | `/home/lkjsxc/.cargo/bin/cargo fmt --check`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage commands`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage`; `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-storage --all-targets -- -D warnings`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-storage-manifest-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-rust-style` | passed | not run |
| 2026-06-09 | Execution docs queue cleanup | `pnpm check:repo`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-rust-style` | passed | not run |
| 2026-06-09 | Storage command metadata and pressure Stats projection | `pnpm check:repo`; `cargo run -p lkjstr-xtask -- check-docs`; `cargo run -p lkjstr-xtask -- check-lines`; `cargo run -p lkjstr-xtask -- check-storage-manifest-docs`; `cargo fmt --check`; `cargo test -p lkjstr-storage`; `cargo test -p lkjstr-web`; `pnpm test -- tests/unit/repo-github-metadata.test.ts tests/unit/cache tests/unit/events/repository.test.ts`; `pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts`; `pnpm rust-wasm:quiet` | passed | not run |
| 2026-06-09 | Active account selector product wiring | `pnpm check:repo`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`; `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-storage-manifest-docs`; `/home/lkjsxc/.cargo/bin/cargo fmt --check`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage active_account`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-storage`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web active_account`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web accounts`; `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web`; `PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome crates/lkjstr-web -- active_selector_get_put_delete`; `PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome crates/lkjstr-web -- accounts_migrates`; `PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome crates/lkjstr-web -- accounts_reports_selector_read_failure`; `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet` | passed | not run |

## Docker Final Path

Before a major handoff or deletion claim, run:

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

Record skipped final gates in commit trailers or handoff notes.
