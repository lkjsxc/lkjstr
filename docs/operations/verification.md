# Verification

## Purpose

Verification commands prove docs, source, unit behavior, build, and browser
flows.

## Quiet Verification Contract

Quiet commands are canonical for LLM-agent and CI runs.

A passing quiet command prints only one final success line:

- `ok test`
- `ok e2e`
- `ok verify`
- `ok ci`
- `ok cloudflare`
- `ok rust-wasm`

Quiet commands capture child stdout and stderr in memory. They print captured
output only when the child exits with a nonzero status, is terminated by a
signal, or fails to spawn.

Quiet commands must not hide diagnostics. On failure they print the step name,
exit status or signal, and the captured output tail (128 KiB byte budget).

Normal verbose commands remain available for local debugging:

- `pnpm test`
- `pnpm test:e2e`
- `pnpm verify`
- `pnpm cloudflare:dry-run`

CI must use quiet commands by default.

## Local

Current product runtime commands:

```sh
pnpm check:repo
pnpm test:quiet
pnpm test:e2e:quiet
pnpm rust-wasm:quiet
pnpm verify:quiet
pnpm ci:quiet
pnpm cloudflare:quiet
```

Rust/WASM target commands:

```sh
cargo run -p lkjstr-xtask -- quiet rust-wasm
pnpm rust-wasm:quiet
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo test --workspace
wasm-pack test --headless --chrome crates/lkjstr-web
wasm-pack test --headless --firefox crates/lkjstr-web
trunk build --release
pnpm test:e2e:quiet
pnpm cloudflare:quiet
```

SQLite OPFS focused commands:

```sh
cargo test -p lkjstr-storage
wasm-pack test --headless --chrome crates/lkjstr-web -- storage
wasm-pack test --headless --firefox crates/lkjstr-web -- storage
pnpm exec playwright test tests/e2e/sqlite-opfs-worker.spec.ts --project chromium
pnpm test:e2e:quiet -- sqlite-opfs
```

Rust relay host focused commands:

```sh
cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings
wasm-pack test --headless --chrome crates/lkjstr-web -- relay_socket
wasm-pack test --headless --chrome crates/lkjstr-web -- browser_timeout
wasm-pack test --headless --firefox crates/lkjstr-web -- relay_socket
wasm-pack test --headless --firefox crates/lkjstr-web -- browser_timeout
```

## Docker

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify e2e cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm e2e
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

Focused change-area gates live in [focused-gates.md](focused-gates.md). Run the
matching focused gate before the final Docker gate when a change touches that
area.

## Gate

Use `pnpm verify:quiet` for normal agent and CI verification. Use
`pnpm ci:quiet` when the full local plus browser gate is required in one
command. `ci:quiet` runs repository checks, lint, typecheck, unit tests,
build, and e2e. It does not include Cloudflare dry-run; run
`pnpm cloudflare:quiet` or the Compose `cloudflare` service separately after
adapter or Wrangler changes.

Use verbose `pnpm verify`, `pnpm test`, and `pnpm test:e2e` when debugging
failures locally. Docker Compose is the final gate before claiming verified
agent changes. CI must run the same quiet local, browser, and Docker-backed
gates.

Run `pnpm check:repo` after documentation changes before code work continues.

## Acceptance Checks

- Open every New Tab choice at desktop and mobile widths and confirm no
  document or pane horizontal overflow.
- Reload the root route with local storage and IndexedDB unavailable. Confirm
  `.workspace-shell`, the Welcome tab, and nonzero body height stay visible with
  no page error.
- Reload the root route with OPFS unavailable after SQLite cutover. Confirm the
  app recovers to a usable Welcome workspace with visible storage diagnostics.
- Verify COOP and COEP headers on static hosting when the primary SQLite OPFS
  path is enabled.
- Verify `/sqlite-opfs-worker.js` and `/sqlite/` official SQLite WASM assets are
  present in Trunk and SvelteKit build output until the old runtime is removed.
- Verify multi-tab SQLite ownership produces shared safe operation or a visible
  lock/unavailable state, never database corruption.
- Verify cache compaction keeps protected SQLite rows and reports quota or stop
  reasons when it cannot reach the target.
- Home and Global lists fill the tile after split resizing.
- Global, Notifications, Thread, and Profile note rows show avatar/name
  fallbacks, timestamps, and wrapped content.
- Profile renders summary first, then note rows in the same Profile tab scroll
  owner at desktop and mobile widths.
- Profile header display name, `npub`, actions, facts, and about text remain
  below the banner bottom at desktop, mobile, and split-pane widths.
- Profile website and safe about-text URLs are clickable anchors with HTTP or
  HTTPS `href` values; unsafe schemes are not anchors.
- Profile visible facts do not include `nprofile` or loaded-post counts.
- Profile copy menu exposes `Copy npub`, `Copy nprofile`,
  `Copy follow list JSON`, and `Copy relay sets JSON`.
- Timeline scroll position remains nonzero after older loads and live prepends
  when the user was not at the top.
- Profile summary scrolls away when note rows scroll, with no nested Notes
  scroller and no horizontal overflow on narrow panes.
- Profile note rows preserve real relay provenance and use `cache` only when
  older records have no relay evidence.
- Home reloads with cached history visible before relay responses and before
  profile hydration.
- Identity rendering remains stable when cached rows reload without fresh
  metadata responses.
- Media embeds hide their source URL from post text only when the same URL
  renders as an image, video, or audio attachment.
- `nostr:npub` and `nostr:nprofile` clicks open Profile; `nostr:note` and
  `nostr:nevent` clicks open Thread in the same tile.
- Notifications show left-aligned action headers and render source notification
  events with canonical `EventRow` behavior for reactions, reposts, replies,
  and quotes.
- Notification rows hide the outer actor chip only when the source event
  already shows the notification actor.
- Notification fallback target/root context is explicitly labeled and appears
  only when the source notification event is unavailable. Fallback rows keep
  the outer actor chip.
- Kind `7` content `+` and empty content render as heart reactions, and
  notification rows do not render `liked`.
- Reaction/repost expanded actor rows and notification action rows are
  left-aligned by computed style and geometry.
- Notification records without `targetEventId` or `rootEventId` do not call
  Thread navigation with an empty id.
- Quote and reference previews are deduped by event id.
- Tweet publish clears and focuses the composer after signing/local queueing
  without showing persistent `Sent to` or `Published` success text.
- Inactive feed tabs keep hidden mounted bodies, pause relay subscriptions and
  page reads, and restore from DOM, warm snapshots, or IndexedDB when reselected
  or reloaded.
- Focus changes, cross-pane moves, edge-split moves, reloads, active-tab reload,
  Settings restore, and explicit close cleanup must have Playwright coverage
  with protocol-shaped synthetic relay data.
- Unit coverage must prove tab-owned durable keying, save/load after pane move,
  delete-by-tab-id, stale-row cleanup, warm LRU cap, falsy snapshot merge,
  one-shot restore consume, stale-token rejection, and absent-tab-only cleanup.
- Memory checks cover warm snapshot caps, released scroll owners/providers/timers
  after close, no old pane leaks after movement, and no hidden feed paging.
- Queued relay page reads abort when the owning runtime or subscription manager
  closes and must not remain in per-relay limiter queues.
- Browser memory checks cover inactive-tab churn after snapshot restore,
  bounded fallback stores, and the heavy-feed heap smoke path.
- lkjstr Log renders one flat chronological wrapped stream.
- Older cached events without relay arrays render with `cache` provenance.
- In clean Playwright, any SES lockdown console message must be reproduced
  before it is treated as app-origin.

## Memory

The heavy-feed browser smoke test reports app JavaScript heap, runtime item
counters, and total Chromium RSS when available. The app heap assertion runs
only when Chromium exposes `performance.memory`; otherwise the heap value is
skipped and the browser flow still verifies rendering. RSS remains diagnostic
because browser baseline memory is outside app control.
