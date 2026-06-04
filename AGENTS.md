# Agent Instructions

## Purpose

This file defines repository instructions for automated coding agents.

## Contract

lkjstr is a docs-first browser Nostr workspace moving to a Rust/WASM-first
client and a worker-owned SQLite OPFS storage kernel. Use
[docs/README.md](docs/README.md) as the docs tree index. Keep
[docs/current-state.md](docs/current-state.md), the relevant `docs/` contract,
and implementation aligned in the same change. Keep source files under 200
lines, docs under 300 lines, avoid release shorthand wording in docs, and use
factory functions instead of first-party classes in `src`.

Prefer Rust/WASM for new product implementation. Keep TypeScript and Svelte
runtime code only where it is still the implemented surface or where browser
host glue, Wrangler, or migration tests require it. Remove TypeScript or Svelte
product code after equivalent Rust/WASM behavior is real and verified.

## Product Rules

- The root route renders the workspace app.
- Tiles have a tab strip, plus button, tile menu, and persistent resize state.
- New Tab offers Home, Tweet, Notifications, Search, Custom Request, Global,
  Profile Edit, Accounts, Relay Settings, Stats, Settings, Upload Settings,
  lkjstr Log, Mine npub, and Welcome.
- Clean startup focuses Welcome and also creates Accounts, Relay Settings,
  Home, Notifications, and Tweet. Storage failure must recover to a usable
  Welcome workspace.
- Profile tabs open from identity clicks. Profile Edit opens for active-account
  metadata editing. Thread tabs open from event clicks.
- Settings are one flat key-value list.
- Selected read relays are eligible fallback relays for Home, Global,
  Notifications, Profile, and Thread. Targeted reads may also use bounded
  protocol-derived routes from NIP-65, NIP-02, entity or tag hints, event relay
  receipts, and local route evidence. Global stays selected-relay based.
- Tweet writes use enabled write relays in the selected default set.
- Tweet publish clears after local signing and queueing, not after relay OKs.
- Incoming NIP-30 custom emoji shortcodes accept letters, numbers,
  underscores, and hyphens. Manual lkjstr shortcode creation remains stricter:
  emit only letters, numbers, and underscores.
- Notification and reference previews must be backed by real events or a
  compact unavailable state; do not add mock preview content.
- Partial relay failure stays diagnostic and must not block reachable relays.
- Disabled or removed relays are excluded until the user enables or restores
  them.
- NIP-11 relay metadata and NIP-65 relay-list suggestions must come from real
  protocol data. Suggestions require explicit import and must not overwrite a
  disabled relay record.
- Docker checks build images and do not mount the source tree.
- Browser workflow suites are not canonical verification gates.
- New source may not import Dexie. The current Dexie binding is deletion-only
  until the SQLite cutover removes it.
- `src/lib/storage/sqlite-opfs/` owns current SQLite worker host glue;
  `src/lib/storage/sqlite/` owns new database access modules when added.
- First-party storage workers use factory functions and plain data, not classes.
- Relay, diagnostic, and tab runtime memory must be bounded or cleaned up
  through explicit close and destroy paths. Durable cached events are not capped
  by a fixed application item count; runtime feed windows and relay read caps
  remain bounded.

## Source Map

- `Cargo.toml`: Rust workspace plus the Trunk build package.
- `crates/lkjstr-protocol`: Nostr protocol kernel.
- `crates/lkjstr-domain`: pure reducers and shared models.
- `crates/lkjstr-relays`: relay state machines and schedulers.
- `crates/lkjstr-storage`: storage manifest, repositories, and ledger.
- `crates/lkjstr-app`: browser-local app composition.
- `crates/lkjstr-ui`: Leptos UI surfaces.
- `crates/lkjstr-web`: WASM entrypoint and browser host adapters.
- `crates/lkjstr-xtask`: repository checks and quiet gates.
- `src/lib/protocol`: Nostr event, filter, tag, and relay URL contracts.
- `src/lib/workspace`: layout, tab, split, recovery, and persistence commands.
- `src/lib/relays`: relay set storage, clients, and pool behavior.
- `src/lib/timeline`, `src/lib/profile`, `src/lib/thread`: read runtimes.
- `src/lib/tweet`: durable drafts and NIP-07 publish helpers.
- `src/lib/storage`: storage repositories, inventory, retention, and worker glue.
- `src/lib/tabs`: tab-owned Svelte surfaces.

## Verification

Run focused checks after edits. Docker Compose is the authoritative final gate:
validate config, build `app`, `verify`, `cloudflare`, and `app-smoke`, then run
`verify`, `cloudflare`, and `app-smoke` services from those images. Use
synthetic relay tests at module level and host-boundary tests only where Node
cannot represent the browser API.

## Commit Protocol

Every commit message follows [docs/repository/commit-protocol.md](docs/repository/commit-protocol.md).
Start with an intent line, then use Lore trailers only when they record useful
decision context. `Tested:` and `Not-tested:` must match actual verification.
