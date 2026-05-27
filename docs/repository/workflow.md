# Workflow

## Purpose

Workflow docs define the change process.

## Steps

1. Read the relevant docs.
2. Update docs to describe the intended behavior.
3. Implement the narrowest matching source change.
4. Add or update focused tests.
5. Run local verification with quiet commands (`pnpm verify:quiet`, or
   `pnpm ci:quiet` when browser tests are required). Use verbose
   `pnpm verify` / `pnpm test` / `pnpm test:e2e` only when debugging failures.
6. Run Docker verification with `--progress quiet` when image or Compose
   behavior changes.
7. Keep CI behavior aligned with quiet local and Docker verification.
