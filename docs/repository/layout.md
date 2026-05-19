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

- `src/lib/accounts`: account records, NIP-07 access, and mining.
- `src/lib/cache`: cache status, retention, and compaction.
- `src/lib/events`: stored event repository, feed windows, and event trees.
- `src/lib/identity`: display names, avatars, profiles, and npub helpers.
- `src/lib/notifications`: notification records, index, and runtime.
- `src/lib/profile`: profile cache and runtime.
- `src/lib/protocol`: Nostr events, filters, NIP-19, tags, and verification.
- `src/lib/relays`: relay storage, relay pool, and subscriptions.
- `src/lib/settings`: flat Settings schema, storage, and validation.
- `src/lib/storage`: browser database and safe storage wrappers.
- `src/lib/tabs`: tab surfaces and tab-specific UI.
- `src/lib/telemetry`: runtime health measurements.
- `src/lib/timeline`: Home and Global timeline runtimes.
- `src/lib/thread`: thread cache, runtime, and focused event loading.
- `src/lib/tweet`: Tweet drafts and publish helpers.
- `src/lib/workspace`: workspace model, layout, tab registry, and persistence.
