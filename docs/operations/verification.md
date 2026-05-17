Owner: Operations
State: Canon

# Verification

## Purpose

Verification proves the docs, source, app build, and browser behavior stay
aligned.

## Local Commands

- `pnpm check:repo` validates docs topology and line limits.
- `pnpm lint` runs ESLint and Prettier checks.
- `pnpm check` runs Svelte and TypeScript checks.
- `pnpm test` runs unit and integration tests.
- `pnpm build` builds the browser app.
- `pnpm test:e2e` runs Playwright behavior checks.
- `pnpm verify` runs the standard local gate.
- `pnpm verify:e2e` runs the full local gate plus Playwright.

## Compose Commands

- `docker compose run --rm verify` is the required batch gate.
- `docker compose up app` starts the browser app.

## Acceptance

- Run the narrowest useful command before the full gate.
- Run the Compose gate before each coherent commit.
- Run Playwright when workspace, account, publish, or relay UI behavior changes.
