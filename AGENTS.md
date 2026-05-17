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
- Keep the top header limited to `lkjstr` and a build label.
- Add tabs through the per-tile plus button.
- Use a New Tab chooser to select tab kind.
- Do not use a left sidebar tab-add menu.
- Close a tile automatically when its final tab closes.
- Recover a new tile automatically when the final tile closes.
- Put tile actions in an anchored three-dot menu.
- Ensure tile menu positioning is local to the clicked trigger.
- Put tab close buttons inside tab frames.
- Use real container-size-based resize sensitivity.
- Do not expose manual split-size reset UI.
- Do not add explicit 3-way or 5-way split buttons.
- Make normal split actions create smart N-way layouts.
- Fetch and render real timeline events from relays.
- Keep settings grouped and key-value editable without filtering.
- Make Timeline, Profile, Relay Settings, Posts, Accounts, Notifications,
  Cache, Composer, and Thread production tabs.
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
- Never render mock placeholder text in production tabs.

## Verification

- Run the narrowest useful command first.
- Use Docker Compose for build, test, and verification.
- Run `docker compose run --rm verify` before claiming a batch is complete.
- Run Playwright when UI behavior changes.
- Use synthetic relays for automated timeline and profile tests.
- Add tests for tile menu positioning, plus-to-new-tab, tab conversion,
  minimal header, settings layout, tab close geometry, resize sensitivity,
  and production tab data flows.
