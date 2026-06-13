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
The Rust Accounts body renders protected account rows, saves read-only,
NIP-07, and local `nsec` imports through Rust IndexedDB repositories, stores
local secrets separately, and exposes local `nsec` values only after an
explicit reveal command.
The Rust Relay Settings body renders protected relay-set rows, seeds default
user/discovery sets, edits relay enablement and user read/write flags, and
restores default sets through Rust storage commands.
The Rust Upload Settings body renders shared Tweet media upload settings,
persists provider/custom-server/no-transform changes, reports Blossom endpoints,
and performs real NIP-96 discovery through the Rust browser host.
The Rust Tweet body renders a real draft editor backed by protected
`tweetDrafts` rows. It loads `tab:{tabId}` drafts, falls back to the `main`
draft when needed, and persists text plus sensitive-warning fields
without pretending that publish transport is converted.
The Rust Home body renders a narrow shared-feed view model. The default Rust
shell asks a host provider for protected SQLite account, relay, follow-list,
coverage, and cached event evidence; injected models remain test-only. The
provider renders real cached rows when present and keeps missing proof explicit.
It can publish bounded selected-relay snapshots after partial cache proof and
keeps startup storage failures visible as Home account and relay diagnostics.
It does not replace the shipped Svelte Home runtime.
The Rust Global body renders `GlobalFeedView` rows from real app row models.
Its default host provider loads selected-relay SQLite cache rows, requires exact
Global coverage before cache-ready, starts bounded selected-relay reads after
partial proof, releases on tab cleanup, and keeps no-relay or partial states
explicit. Global scroll parity remains open.
The Rust Notifications body renders `NotificationsFeedView` rows from real app
row models. Its default host provider loads active-account SQLite notification
records and cached source events, promotes cache-ready only from exact account
`#p` coverage, starts bounded selected-relay reads after partial proof, and
renders status, rows, events, and footer inside one Notifications scroll owner.
Pure Rust cursor and fill-then-scroll intent proof exists. Rust/WASM proof now
covers bounded older relay filters, event rejection, and empty older-window
footer behavior. The older-ready footer renders a real `feed.loadOlder` command
button that asks the host to start the next bounded older relay read from
retained relay state. Automatic scroll-gesture orchestration remains open.
Cleanup releases provider leases and suppresses late completions.

Not implemented yet: remaining feed-surface host providers beyond Home, Global,
and partial Notifications, most tool surfaces, Stats relay/job/compaction
diagnostics, Settings appearance side effects, Relay Settings
NIP-11/suggestions/diagnostics, Upload Settings file upload/NIP-98 transport,
Tweet signing/publish/media/custom emoji transport, and full responsive/a11y QA.

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
