# Scripts

## Purpose

This directory contains Node scripts used by development and verification
commands.

## Contents

- `check-repo.ts`: repository contract checker.
- `generate-icons.ts`: static icon generation.
- `repo-source-classes.ts`: TypeScript AST guard that rejects first-party
  classes under `src/` except the Dexie database binding.
- `run-quiet.ts`: concise command runner for agent verification.

`pnpm check:repo` runs the class guard along with documentation, README,
Compose, line-length, and forbidden dependency text checks.
