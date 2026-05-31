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
The Rust Stats body renders host-collected IndexedDB table counts plus compact
workspace counters; relay, job, compaction, and memory diagnostics stay marked
unavailable until their Rust providers are implemented.
The Rust Settings body renders the flat schema from Rust, merges real
IndexedDB setting overrides, and saves raw key-value edits through a host
provider.
The Rust Accounts body renders protected account rows, saves read-only and
local `nsec` imports through Rust IndexedDB repositories, stores local secrets
separately, and exposes local `nsec` values only after an explicit reveal
command.
The Rust Relay Settings body renders protected relay-set rows, seeds default
user/discovery sets, edits relay enablement and user read/write flags, and
restores default sets through Rust storage commands.
The Rust Upload Settings body renders shared Tweet media upload settings,
persists provider/custom-server/no-transform changes, and performs real NIP-96
discovery through the Rust browser host.
The Rust Tweet body renders a real draft editor backed by protected
`tweetDrafts` rows. It loads `tab:{tabId}` drafts, falls back to the `main`
draft when needed, and persists text plus sensitive-warning fields
without pretending that publish transport is converted.

Not implemented yet: feed surfaces, most tool surfaces, relay-backed content,
Stats relay/job/compaction diagnostics, Settings appearance side effects,
Accounts NIP-07 login, Relay Settings NIP-11/suggestions/diagnostics, Upload
Settings file upload/NIP-98 transport, Tweet signing/publish/media/custom emoji
transport, and full responsive/a11y QA.

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
