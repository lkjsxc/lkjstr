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
- Open new tabs from the collapsible left sidebar.
- Remove tile footer tab-creation controls.
- Close a tile automatically when its final tab closes.
- Recover a new tile automatically when the final tile closes.
- Put tile actions in a three-dot menu.
- Do not expose manual split-size reset UI.
- Do not add explicit 3-way or 5-way split buttons.
- Make normal split actions create smart N-way layouts.
- Fetch and render real timeline events from relays.
- Keep settings searchable, categorized, and key-value editable.
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
- Never leave dangling pane, tab group, or tab references.
- Never let the workspace remain blank after closing the final tile.

## Verification

- Run the narrowest useful command first.
- Use Docker Compose for build, test, and verification.
- Run `docker compose run --rm verify` before claiming a batch is complete.
- Run Playwright when UI behavior changes.
- Use synthetic relays for automated timeline tests.
- Add tests for root route, sidebar toggle, last-tab tile close, zero-panel
  recovery, smart split, tile menu, settings layout, and timeline fetch.
