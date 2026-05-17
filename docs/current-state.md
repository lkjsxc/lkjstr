Owner: Repository maintainers
State: Canon

# Current State

The repository currently contains a SvelteKit application scaffold, local
compose services, tests, scripts, project licensing, and this documentation set.

## Known Assets

- `LICENSE` exists at the repository root.
- `package.json` defines a private module package managed by `pnpm`.
- `compose.yaml` defines `app` and `verify` services using Node 24.
- `src/` contains Svelte application routes and styles.
- `tests/` contains unit and end-to-end test entry points.
- `scripts/check-repo.ts` provides repository checks.
- `docs/` records repository guidance, vision, and current-state notes.

## Current Stack Signals

- Runtime target: Node 24 or newer.
- App framework: SvelteKit with Vite.
- Language tooling: TypeScript, ESLint, Prettier, and Svelte checks.
- Test tooling: Vitest and Playwright.
- Local orchestration: compose services for development and verification.

## Present Docs

- Product, protocol, architecture, operations, decisions, and research docs are
  populated as initial canon.
- `pnpm-lock.yaml` is present.
- Operations docs define local and Compose verification.

## Gaps

- The workspace can persist panes, connect read-only accounts, and request
  NIP-07 signing.
- Playwright covers the workspace shell and local interaction flow.
- Relay, cache, query, account, and workspace modules exist as browser
  foundation modules.
- Protocol modules are still incomplete.

## Remaining Gaps

- IndexedDB persistence exists for workspace foundation records, while full
  cache and settings persistence are still being completed.
- Relay reconnect backoff is not implemented yet.
- Worker verification and indexing are not implemented yet.
- Timeline virtualization is not implemented yet.
- Public relay smoke testing is manual and user-configured.

Available package scripts include `check:repo`, `lint`, `check`, `test`,
`build`, `verify`, and `verify:e2e`.

Compose verification uses `docker compose run --rm verify`.
