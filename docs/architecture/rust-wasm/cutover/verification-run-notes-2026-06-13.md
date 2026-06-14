# Verification Run Notes 2026-06-13

## Purpose

Archive detailed run notes moved out of [verification-ledger.md](verification-ledger.md)
so the active verification ledger stays under the documentation line cap.

## Current Run Notes

- 2026-06-13 Followees selected-relay/stored-route discovery, cleanup, and retry proof passed focused
  Rust, Chrome WASM, clippy, repo, docs, line, style, whitespace, and Rust/WASM quiet gates.
  Commands:
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo fmt --check`; `cargo check -p lkjstr-web --target wasm32-unknown-unknown`;
    `cargo test -p lkjstr-app -- follow`; `cargo test -p lkjstr-ui followees`; `cargo test -p lkjstr-web --lib`.
  - Chrome WASM loop ran `followees_provider_test`, `followees_relay_provider_test`,
    `followees_route_provider_test`, `followees_cleanup_test`, `followees_retry_test`, and
    `profile_feed_tab_test` with `CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUNNER`, `CHROMEDRIVER`,
    and `WASM_BINDGEN_TEST_ONLY_WEB=1` set to the cached Chrome 148 runner.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings`;
    `cargo clippy -p lkjstr-app -p lkjstr-ui --all-targets -- -D warnings`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm check:repo`; `cargo run -p lkjstr-xtask -- check-docs`;
    `cargo run -p lkjstr-xtask -- check-lines`; `cargo run -p lkjstr-xtask -- check-rust-style`; `git diff --check`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet` printed `ok rust-wasm`; Docker final gate was not run.
  - The default Rust Followees host now discovers kind `3` through selected relays or stored NIP-65/provenance/target
    author routes, excludes disabled stored route relays, stores real relay events in worker SQLite, rebuilds from cache,
    cancels owner relay reads on lease release, and renders retry diagnostics. No-import proof and deletion remain open.
- 2026-06-13 User Timeline selected-relay/stored route-group discovery,
  disabled-route exclusion, cleanup, and retry/auth/rate-limit/timeout plus
  partial route diagnostic proof passed focused Rust and Chrome WASM gates. Commands:
  - `/home/lkjsxc/.cargo/bin/cargo fmt --check`.
  - `/home/lkjsxc/.cargo/bin/cargo check -p lkjstr-web --target wasm32-unknown-unknown`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app -- user_timeline`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-ui user_timeline`.
  - Chrome WASM `user_timeline_cleanup_test`, `user_timeline_route_provider_test`,
    `user_timeline_relay_provider_test`, `user_timeline_retry_test`, `user_timeline_timeout_test`,
    and `user_timeline_provider_test` passed with matching ChromeDriver 148.
  - `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings`.
  - `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-app -p lkjstr-ui --all-targets -- -D warnings`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm check:repo`.
  - `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`.
  - `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`.
  - `git diff --check`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet` printed `ok rust-wasm`.
  - The default Rust User Timeline host now starts a bounded selected-relay kind
    `3` read on cache miss, stores the real relay event in worker SQLite, and
    rebuilds the feed from cached real rows. It also reads stored
    NIP-65/provenance/target author routes and can discover kind `3` without
    selected relays while excluding disabled stored route relays and preserving
    partial route-failure diagnostics after another route succeeds. It closes the
    selected-relay read on cleanup, no-event selected reads render retryable
    diagnostics, AUTH selected reads render auth-required diagnostics, and
    CLOSED rate-limited plus timed-out selected reads render retry diagnostics
    without claiming absence. Docker final gate was not run. No-import proof and
    TypeScript/Svelte deletion remain open.
- 2026-06-13 User Timeline exact cached coverage proof passed focused Rust and
  browser WASM gates. Commands:
  - `/home/lkjsxc/.cargo/bin/cargo fmt --check`; `/home/lkjsxc/.cargo/bin/cargo check -p lkjstr-web --target wasm32-unknown-unknown`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app -- user_timeline`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-ui user_timeline`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web user_timeline`.
  - From `crates/lkjstr-web`: `cargo test --target wasm32-unknown-unknown --test user_timeline_provider_test` with cached Chrome runner env.
  - `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings`.
  - `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-app -p lkjstr-ui --all-targets -- -D warnings`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm check:repo`;
    `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`;
    `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`.
  - `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-rust-style`; `git diff --check`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm test:quiet`;
    `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet` printed
    `ok rust-wasm`; `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm verify:quiet`
    printed `ok verify`.
  - The default Rust User Timeline host reads cached kind `3` author sets and
    display events from worker SQLite, keeps rows partial without complete
    coverage, promotes ready only from exact feed/route/relay/filter/interval
    proof, and leaves cache miss in discovery. Docker final gate was not run.
    No-import proof and TypeScript/Svelte deletion remain open.
- 2026-06-13 Followees cached host-provider proof passed focused and quiet
  Rust/WASM gates. Commands:
  - `/home/lkjsxc/.cargo/bin/cargo fmt`.
  - `/home/lkjsxc/.cargo/bin/cargo fmt --check`.
  - `/home/lkjsxc/.cargo/bin/cargo check -p lkjstr-web --target wasm32-unknown-unknown`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app -- follow`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-ui followees`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web --target wasm32-unknown-unknown --test followees_provider_test`
    with `PATH`, `CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUNNER`, `CHROMEDRIVER`,
    and `WASM_BINDGEN_TEST_ONLY_WEB=1` set for the cached Chrome runner.
  - `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings`.
  - `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-app -p lkjstr-ui --all-targets -- -D warnings`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm check:repo`.
  - `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`.
  - `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`.
  - `git diff --check`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet` printed
    `ok rust-wasm`.
  - The default Rust Followees host now reads latest cached kind `3` events
    from worker-owned SQLite, renders real deduped NIP-02 rows, and leaves
    cache miss in loading state for relay discovery. Docker final gate was not
    run. Relay-backed discovery, retry diagnostics, cleanup parity, no-import
    proof, and TypeScript/Svelte deletion remain open.
- 2026-06-13 User Timeline Rust body/provider proof passed focused and quiet
  Rust/WASM gates. Commands:
  - `/home/lkjsxc/.cargo/bin/cargo fmt`.
  - `/home/lkjsxc/.cargo/bin/cargo fmt --check`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app -- user_timeline`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-ui user_timeline`.
  - `/home/lkjsxc/.cargo/bin/cargo check -p lkjstr-web --target wasm32-unknown-unknown`.
  - `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-web --target wasm32-unknown-unknown --test profile_feed_tab_test`
    with `PATH`, `CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUNNER`, `CHROMEDRIVER`,
    and `WASM_BINDGEN_TEST_ONLY_WEB=1` set for the cached browser runner.
  - `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-relays -p lkjstr-app -p lkjstr-ui --all-targets -- -D warnings`.
  - `/home/lkjsxc/.cargo/bin/cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm check:repo`.
  - `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-docs`.
  - `/home/lkjsxc/.cargo/bin/cargo run -p lkjstr-xtask -- check-lines`.
  - `git diff --check`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet` printed
    `ok rust-wasm`.
  - `check-lines` initially failed on `feed_surface_input_test.rs` at 219
    lines; the User Timeline surface-input proof was split into
    `user_timeline_surface_input_test.rs`, then `check-lines` passed.
  - Docker final gate was not run. The slice remains partial: relay-backed
    route discovery, retry diagnostics, cleanup parity, no-import proof, and
    TypeScript/Svelte deletion remain open.
- 2026-06-10 agent manual, skills subtree, compact `AGENTS.md`, skill-shape
  checks, and Markdown formatting normalization passed all gates. Commands:
  - `pnpm check:repo`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo fmt --check`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo clippy -p lkjstr-xtask --all-targets -- -D warnings`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-xtask`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo run -p lkjstr-xtask -- check-docs`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo run -p lkjstr-xtask -- check-lines`.
  - `pnpm verify:quiet` printed `ok verify` after `prettier --write` fixed
    eighteen Markdown and test files that failed `prettier --check` before
    this slice.
  - Docker final gate ran fully: Compose config, image builds for `app`,
    `verify`, `cloudflare`, and `app-smoke`, then `verify`, `cloudflare`, and
    `app-smoke` services passed from those images.
  - `pnpm rust-wasm:quiet` was not run; the slice changed no WASM-facing
    source, only `lkjstr-xtask` checks covered by crate tests.
- 2026-06-10 documentation readability, topology, and storage/Search status
  checks passed. Commands:
  - `pnpm install`.
  - `git status --short`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm check:repo`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo fmt --check`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo clippy -p lkjstr-xtask --all-targets -- -D warnings`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-xtask`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo run -p lkjstr-xtask -- check-docs`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo run -p lkjstr-xtask -- check-lines`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo run -p lkjstr-xtask -- check-storage-manifest-docs`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo run -p lkjstr-xtask -- check-rust-style`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-storage`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-web`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm test:quiet`.
  - `PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet`.
- Source inspection confirmed `search.local-query` has Rust command metadata,
  indexed token SQL, the `lkjstr-web` local query adapter, and a worker-backed
  Rust Search provider that renders local indexed rows and bounded relay NIP-50
  snapshots plus tab snapshot restore, cached older pages, and relay older
  pages. Broader parity and deletion proof remain open.
- Plain Cargo tool lookup resolves to `/home/lkjsxc/.bun/bin/cargo` in this
  shell and fails on a missing obsolete Compose file. Verification above used
  `PATH=/home/lkjsxc/.cargo/bin:$PATH` to run the real Cargo binary.
- Docker final gate was not run for this docs and check pass.
