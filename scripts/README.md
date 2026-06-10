# Scripts

## Purpose

This directory contains Node scripts used by development and verification
commands.

## Table of Contents

- `app-smoke.ts`: production preview smoke check for `/`.
- `check-repo.ts`: repository contract checker.
- `repo-compose.ts`: Docker Compose guardrails.
- `repo-docs.ts`: docs topology and prose checks.
- `repo-doc-task-shape.ts`: required headings for execution task files.
- `repo-doc-skill-shape.ts`: required headings for agent skill files.
- `repo-source-classes.ts`: TypeScript AST guard that rejects first-party
  classes under `src/`.
- `run-quiet.ts`: quiet verification runner for agents and CI.
- `vite-lkjstr-web-wasm.ts`: optional Vite asset plugin for the Rust scan bridge.
- `vitest-quiet-reporter.ts`: minimal Vitest reporter for quiet unit runs.

`pnpm check:repo` runs the class guard along with documentation, README,
Compose, line-length, storage, timer, runtime counter, and dependency text
checks.

## Quiet Runner

Modes: `test`, `verify`, `ci`, `cloudflare`, `rust-wasm`.

- Passing run: prints exactly one line, `ok <mode>`.
- Failing run: prints `failed <step>`, exit code or signal, then the captured
  stdout/stderr tail using the shared byte budget.
- Successful child steps print nothing.

`ci` runs repository checks, lint, typecheck, unit tests, and build. It does not
include Cloudflare dry-run.
