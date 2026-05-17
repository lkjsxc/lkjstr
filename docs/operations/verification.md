Owner: Operations
State: Canon

# Verification

## Purpose

Verification proves the docs, source, app build, and browser behavior stay
aligned.

## Local Commands

- `CI=1 pnpm check:repo` validates docs topology and line limits.
- `CI=1 pnpm lint` runs ESLint and Prettier checks.
- `CI=1 pnpm check` runs Svelte and TypeScript checks.
- `CI=1 pnpm test` runs unit and integration tests.
- `CI=1 pnpm build` builds the browser app.
- `CI=1 pnpm test:e2e` runs Playwright behavior checks.
- `CI=1 pnpm verify` runs the standard local gate.
- `CI=1 pnpm verify:e2e` runs the full local gate plus Playwright.

## Compose Commands

- `docker compose run --rm verify` is the required batch gate.
- `docker compose up app` starts the browser app.

## Acceptance

- Run the narrowest useful command before the full gate.
- Run the Compose gate before each coherent commit.
- Run Playwright when workspace, account, publish, or relay UI behavior changes.
- Use synthetic relays for automated timeline behavior.
- Run root route, tile plus, New Tab chooser, tile menu position, tab close,
  resize, settings, production tab, and timeline checks after UI changes.
