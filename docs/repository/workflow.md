# Workflow

## Purpose

Workflow docs define the change process.

## Steps

1. Read the relevant docs.
2. Update docs to describe the intended behavior and the verification evidence
   that would prove it.
3. Implement the narrowest matching source change.
4. Add or update focused tests.
5. Run local verification with quiet commands. Current product code uses
   `pnpm verify:quiet`; `pnpm ci:quiet` intentionally matches automatic CI and
   runs only `pnpm check:repo`. Rust/WASM slices also run cargo, WASM, Trunk,
   and `lkjstr-xtask` checks documented in
   [verification.md](../operations/verification.md).
6. Run Docker Compose as the final gate when the change class requires it:
   config, image builds, then `verify`, `cloudflare`, and `app-smoke` services
   with `--progress quiet`.
7. Keep CI behavior aligned with [../operations/ci.md](../operations/ci.md):
   automatic GitHub Actions are repository-only while long-action suspension is
   active.

## Commit Slices

- Prefer small commits around one contract and its matching implementation.
- If a navigation or standards cleanup is independent, commit it before product
  behavior changes.
- Do not commit a product behavior doc that knowingly disagrees with source at
  the end of the slice.
