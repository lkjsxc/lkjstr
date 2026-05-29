# Workflow

## Purpose

Workflow docs define the change process.

## Steps

1. Read the relevant docs.
2. Update docs to describe the intended behavior and the verification evidence
   that would prove it.
3. Implement the narrowest matching source change.
4. Add or update focused tests.
5. Run local verification with quiet commands (`pnpm verify:quiet`, or
   `pnpm ci:quiet` when browser tests are required). Use verbose
   `pnpm verify` / `pnpm test` / `pnpm test:e2e` only when debugging failures.
6. Run Docker Compose as the final gate: config, image builds, then `verify`,
   `e2e`, and `cloudflare` services with `--progress quiet`.
7. Keep CI behavior aligned with quiet local and Docker Compose verification.
