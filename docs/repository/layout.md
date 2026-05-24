# Layout

## Purpose

Layout docs map repository paths to ownership.

## Root

- `src/`: SvelteKit app and TypeScript modules.
- `docs/`: product and engineering contract.
- `tests/unit/`: Vitest unit tests.
- `tests/e2e/`: Playwright browser tests.
- `Dockerfile`: app, verify, and e2e image targets.
- `docker-compose.yml`: built-image services.
- `.github/workflows/ci.yml`: hosted gates and GHCR publishing.

## Source

- `src/lib/accounts`: account records, local secret handling, NIP-07 access,
  and mining.
- `src/lib/app`: app metadata, runtime counters, and runtime log helpers.
- `src/lib/author-context`: nearby-author query helpers.
- `src/lib/cache`: cache status, retention, and compaction.
- `src/lib/components`: shared Svelte UI components.
- `src/lib/custom-request`: validated custom relay request parsing.
- `src/lib/deck`: deck route state helpers.
- `src/lib/emoji`: emoji picker source data.
- `src/lib/events`: stored event repository, feed windows, and event trees.
- `src/lib/fp`: small functional helpers, bounded maps, emitters, and scopes.
- `src/lib/identity`: display names, avatars, profiles, and npub helpers.
- `src/lib/jobs`: persisted background job records and health.
- `src/lib/log`: current-session app log storage.
- `src/lib/media`: media endpoint, provider, settings, and upload helpers.
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
