# Scripts

## Purpose

This directory contains Node scripts used by development and verification
commands.

## Table of Contents

- `app-smoke.ts`: production preview smoke check for `/`.
- `check-repo.ts`: repository contract checker.
- `repo-compose.ts`: Docker Compose guardrails.
- `repo-author-context-deletions.ts`: deleted Author Context loader no-import
  guard.
- `repo-deleted-paths.ts`: guard that removed transitional paths stay absent.
- `repo-docs.ts`: docs topology and prose checks.
- `repo-doc-task-shape.ts`: required headings for execution task files.
- `repo-doc-skill-shape.ts`: required headings for agent skill files.
- `repo-event-menu.ts`: deleted Svelte event menu and helper API guard.
- `repo-feed-tab-islands.ts`: retained and deleted feed tab no-import guard.
- `repo-feed-surface-deletions.ts`: deleted feed-surface helper no-import guard.
- `repo-source-classes.ts`: TypeScript AST guard that rejects first-party
  classes under `src/`.
- `repo-transitional-deletions.ts`: deleted transitional helper no-import
  guard.
- `repo-user-timeline-deletions.ts`: deleted User Timeline helper no-import
  guard.
- `run-quiet.ts`: quiet verification runner for agents and CI.
- `vite-lkjstr-web-wasm.ts`: Vite asset plugin for the Rust browser bridge.
- `wasm-toolchain.ts`: wasm-pack preflight and product-safe bridge messages.
- `vitest-quiet-reporter.ts`: minimal Vitest reporter for quiet unit runs.

`pnpm check:repo` runs the class guard along with documentation, README,
Compose, deleted-path, line-length, storage, timer, deleted event-menu,
deleted Author Context loader, feed-tab island, deleted feed-surface helper,
deleted transitional helpers, deleted User Timeline helper, runtime counter,
and dependency text checks.

## Quiet Runner

Modes: `test`, `verify`, `ci`, `cloudflare`, `rust-wasm`.

- Passing run: prints exactly one line, `ok <mode>`.
- Failing run: prints `failed <step>`, exit code or signal, then the captured
  stdout/stderr tail using the shared byte budget.
- Successful child steps print nothing.

`ci` runs repository checks, lint, typecheck, unit tests, and build. It does not
include Cloudflare dry-run.
