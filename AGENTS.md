# Agent Instructions

## Repository Canon

- Treat `docs/` as the source of truth before changing behavior.
- Keep docs files at 300 lines or fewer.
- Keep authored source files at 200 lines or fewer.
- Keep one canonical owner for each contract.
- Update parent `README.md` files when docs children change.
- Remove stale contracts instead of preserving conflicts.
- Avoid numbered release shorthand in authored docs.

## Product Target

- Build `lkjstr` as a browser-first TypeScript Nostr deck client.
- Keep the deck and tile model central.
- Keep runtime relay defaults user-configured.
- Keep protocol code independent from UI code.
- Keep relay, cache, query, and worker contracts explicit.

## Implementation Rules

- Read local code before changing contracts.
- Update docs before implementation.
- Keep changes small enough to verify.
- Preserve unrelated working-tree changes.
- Prefer typed parsers and local helpers.
- Never log private keys or wallet secrets.

## Verification

- Run the narrowest useful command first.
- Use Docker Compose for build, test, and verification.
- Run `docker compose run --rm verify` before claiming a batch is complete.
- Run Playwright when UI behavior changes.
- Add tests for protocol, relay, cache, query, and deck changes.
