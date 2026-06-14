# Layout

## Purpose

Layout docs map repository paths to ownership.

## Root

- `Cargo.toml`: Rust workspace root plus the thin Trunk build package that
  points at the `lkjstr-web` entry source.
- `Cargo.lock`: Rust dependency lockfile.
- `rust-toolchain.toml`: Rust toolchain and WASM target contract.
- `.cargo/`: Cargo configuration.
- `crates/`: Rust protocol, domain, relay, storage, app, UI, web, and
  repository-check crates.
- `index.html`: Trunk browser entry document for the Rust/WASM shell.
- `static/`: target hand-authored static media and manifest assets for the
  Rust root build.
- `public/` or `web/`: target root HTML shell after SvelteKit removal.
- `dist/` or `build/cloudflare/`: target generated Cloudflare static artifact.
- `src/`: current SvelteKit app and TypeScript modules until replaced.
- `docs/`: product and engineering contract.
- `tests/unit/`: focused Vitest unit and integration tests.
- `tools/`: target non-product tooling home.
- `Dockerfile`: app, verify, cloudflare, and app-smoke image targets.
- `docker-compose.yml`: built-image services.
- `package.json`: current Node app tooling; target minimal Vitest, Wrangler,
  and wrapper tooling.
- `.github/_README.md`: repository automation notes that do not replace the
  root project overview on GitHub.
- `.github/workflows/ci.yml`: hosted gates and GHCR publishing.

## Target Crates

- `crates/lkjstr-protocol`: Nostr events, filters, tags, messages, signatures,
  relay URLs, and NIP parsing.
- `crates/lkjstr-domain`: pure reducers, workspace state, feed models,
  settings, diagnostics, and memory labels.
- `crates/lkjstr-relays`: relay state machines, request budgets,
  subscriptions, and orchestration.
- `crates/lkjstr-storage`: storage manifest, repositories, cache ledger,
  retention, repair, and inventory.
- `crates/lkjstr-app`: browser-local services, runtimes, jobs, startup
  recovery, account selection, and commands.
- `crates/lkjstr-ui`: Leptos components and CSS-class rendering contracts.
- `crates/lkjstr-web`: WASM entrypoint and browser host adapters.
- `crates/lkjstr-xtask`: repository checks and quiet gate orchestration.
- `crates/lkjstr-worker`: optional later Rust Worker static router only; it
  must not own product backend behavior.

## Current Source

- `src/lib/accounts`: account records, local secret handling, NIP-07 access,
  and mining.
- `src/lib/app`: app metadata, runtime counters, and runtime log helpers.
- `src/lib/backend`: browser-local shared query services.
- `src/lib/cache`: cache status, retention, and compaction.
- `src/lib/components`: shared Svelte UI components.
- `src/lib/custom-request`: validated custom relay request parsing.
- `src/lib/emoji`: emoji picker source data.
- `src/lib/events`: stored event repository, feed windows, and event trees.
- `src/lib/feed-surface`: shared feed paging and footer helpers.
- `src/lib/fp`: small functional helpers, bounded maps, emitters, and scopes.
- `src/lib/identity`: display names, avatars, profiles, and npub helpers.
- `src/lib/jobs`: persisted background job records and health.
- `src/lib/log`: current-session app log storage.
- `src/lib/media`: media endpoint, provider, settings, and upload helpers.
- `src/lib/memory`: scored retention and runtime memory helpers.
- `src/lib/notifications`: notification records, index, and runtime.
- `src/lib/profile`: profile cache and runtime.
- `src/lib/protocol`: Nostr events, filters, NIP-19, tags, and verification.
- `src/lib/query`: timeline query helpers.
- `src/lib/relays`: relay storage, relay pool, and subscriptions.
- `src/lib/search`: search query parsing and relay-backed search helpers.
- `src/lib/settings`: flat Settings schema, storage, and validation.
- `src/lib/storage`: browser database and safe storage wrappers.
- `src/lib/tabs`: tab surfaces and tab-specific UI.
- `src/lib/telemetry`: runtime health measurements.
- `src/lib/timeline`: Home and Global timeline runtimes.
- `src/lib/thread`: thread cache, runtime, and focused event loading.
- `src/lib/tweet`: composer recovery and publish helpers.
- `src/lib/workspace`: workspace model, layout, tab registry, and persistence.
