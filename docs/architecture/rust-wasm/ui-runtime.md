# UI Runtime

## Purpose

This file defines the Rust UI target. Status: partial.

## Owner

`lkjstr-ui` owns Leptos components and CSS-class rendering contracts. It renders
the real workspace, not a landing page or demo shell.

## First Rust UI Surface

The first Rust UI must implement real startup behavior:

- Root route opens the workspace app.
- Clean launch focuses Welcome.
- Accounts, Relay Settings, Home, Notifications, and Tweet exist as open tabs.
- Storage failure still shows a usable Welcome workspace.
- Pane chrome, tab strip, plus button, tile menu, tab opening, and tab focus
  work from real reducers.
- New Tab choices convert the chooser tab to the selected direct tab kind while
  preserving its tab id.
- Welcome action links open real workspace tabs in the same pane without
  starting relay work by themselves.
- Workspace reducer changes persist through a host-owned callback when the
  browser IndexedDB workspace adapter is available.

Implemented now: the Leptos shell mounts from `lkjstr-web`, renders the Rust
bootstrap workspace, pane chrome, tab strips, Welcome/New Tab bodies, and New
Tab catalog, routes tab focus plus New Tab opening through Rust reducers,
opens Welcome action tabs, and converts New Tab choices while preserving the
chooser tab id. Startup reads a stored Rust workspace row from IndexedDB, and
workspace tab actions write the updated workspace through the same Rust adapter.

Not implemented yet: feed surfaces, tool surfaces, relay-backed content, and
full responsive/a11y QA.

## Component Split

- `app`: top-level composition.
- `workspace`: shell, panes, pane head, pane body, tab strip, tile menu, and New
  Tab menu.
- `tabs`: Welcome, feeds, tools, account surfaces, settings, and diagnostics.
- `feeds`: feed rows, footers, staged rows, reference previews, and scroll
  surfaces.
- `tools`: Tweet, Accounts, Relay Settings, Stats, Upload Settings, Custom
  Request, Search, Mine npub, Profile Edit, and lkjstr Log.

## Data Contract

UI components receive compact view models, IDs, phases, and command handles.
They do not own protocol parsing, relay reads, durable writes, or long-lived
resource maps.

## Rendering Rules

- No fake previews, diagnostics, relay suggestions, or protocol metadata.
- Loading, unavailable, and partial states must be honest and compact.
- Hidden inactive tab bodies remain mounted when the product contract requires
  retention.
- Text and controls must fit desktop and mobile panes without horizontal
  overflow.
