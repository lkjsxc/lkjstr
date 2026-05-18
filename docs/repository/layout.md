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

- `src/lib/workspace`: workspace model.
- `src/lib/relays`: relay storage and pool.
- `src/lib/timeline`: timeline cache and runtime.
- `src/lib/profile`: profile cache and runtime.
- `src/lib/thread`: thread cache and runtime.
- `src/lib/tweet`: Tweet drafts and publish helpers.
