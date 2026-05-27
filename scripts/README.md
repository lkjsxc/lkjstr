# Scripts

## Purpose

This directory contains Node scripts used by development and verification
commands.

## Contents

- `check-repo.ts`: repository contract checker.
- `generate-icons.ts`: static icon generation.
- `repo-source-classes.ts`: TypeScript AST guard that rejects first-party
  classes under `src/` except the Dexie database binding.
- `run-quiet.ts`: quiet verification runner for agents and CI.
- `vitest-quiet-reporter.ts`: minimal Vitest reporter for quiet unit runs.
- `playwright-quiet-reporter.ts`: minimal Playwright reporter for quiet e2e runs.

`pnpm check:repo` runs the class guard along with documentation, README,
Compose, line-length, and forbidden dependency text checks.

## Quiet runner (`run-quiet.ts`)

Modes: `test`, `e2e`, `verify`, `ci`, `cloudflare`.

- Passing run: prints exactly one line, `ok <mode>`.
- Failing run: prints `failed <step>`, exit code or signal, then the captured
  stdout/stderr tail (128 KiB byte budget).
- Successful child steps print nothing.

`ci` runs repository checks, lint, typecheck, unit tests, build, and e2e. It
does not include Cloudflare dry-run.
