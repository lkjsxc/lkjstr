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

- Build `lkjstr` as a browser-first TypeScript Nostr workspace client.
- Serve the workspace at `/`.
- Use an editor-style split-pane tab workspace.
- Support valid empty workspace, empty pane, and zero-tab states.
- Support horizontal and vertical two-way and N-way pane splits.
- Keep settings in a searchable key-value settings tab.
- Use a dark mostly achromatic theme.
- Keep rounded corners very small.
- Seed default relays only when no relay configuration exists.
- Keep protocol code independent from UI code.
- Keep relay, cache, query, worker, account, settings, and workspace contracts explicit.

## Implementation Rules

- Read local code before changing contracts.
- Update docs before implementation.
- Keep changes small enough to verify.
- Preserve unrelated working-tree changes.
- Prefer typed parsers and local helpers.
- Never log private keys or wallet secrets.
- Never let closed tabs retain live subscriptions.
- Never let durable drafts be removed by automatic cache pruning.
- Never assume `focusedPaneId`, `focusedTabId`, or `layout` is non-null.

## Verification

- Run the narrowest useful command first.
- Use Docker Compose for build, test, and verification.
- Run `docker compose run --rm verify` before claiming a batch is complete.
- Run Playwright when UI behavior changes.
- Add tests for empty workspace, root route, settings search, default relays,
  N-way splits, theme, and radius changes.
