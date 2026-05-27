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

Canonical agent and CI commands:

```sh
pnpm check:repo
pnpm test:quiet
pnpm test:e2e:quiet
pnpm verify:quiet
pnpm ci:quiet
pnpm cloudflare:quiet
```

Debugging commands (verbose child output):

```sh
pnpm kit:sync
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm verify
pnpm cloudflare:dry-run
pnpm test:e2e
pnpm test:e2e:memory
```

## Docker

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify e2e cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm e2e
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
```

Run all five Docker command groups before claiming image-backed verification.

Feed regression and filter kernel changes should also run:

```sh
pnpm vitest run tests/unit/query/timeline-filters.test.ts
pnpm vitest run tests/unit/events/event-order.test.ts
pnpm vitest run tests/unit/timeline/timeline-reducer.test.ts
pnpm vitest run tests/unit/notifications/notification-filters.test.ts
pnpm vitest run tests/unit/timeline/timeline-follow-loading.test.ts
pnpm test:e2e -- tests/e2e/timeline-regression.spec.ts tests/e2e/timeline-multi-tab.spec.ts
```

Focused relay paging changes should also run:

```sh
pnpm check:repo
pnpm vitest run tests/unit/events/relay-page-segments.test.ts tests/unit/events/relay-page-density.test.ts
pnpm vitest run tests/unit/events/relay-page-scan.test.ts tests/unit/events/relay-page-scan-hardening.test.ts tests/unit/events/relay-page-scan-cursors.test.ts
pnpm vitest run tests/unit/timeline/timeline-newer-relay-pages.test.ts tests/unit/profile/profile-store.test.ts tests/unit/profile/profile-runtime-paging.test.ts
pnpm verify
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e cloudflare
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
docker compose -f docker-compose.yml run --rm cloudflare
```

Relay runtime hardening changes use these focused slices:

```sh
pnpm check:repo
pnpm test -- tests/unit/protocol/bytes.test.ts tests/unit/protocol/crypto.test.ts tests/unit/protocol/event.test.ts tests/unit/protocol/nip19.test.ts
pnpm test -- tests/unit/accounts/local.test.ts tests/unit/accounts/npub-miner.test.ts
pnpm test -- tests/unit/relays/subscription-manager.test.ts tests/unit/relays/relay-client.test.ts tests/unit/relays/relay-diagnostic-log.test.ts
pnpm test -- tests/unit/relays/relay-pool-publish.test.ts tests/unit/relays/subscription-manager-dedupe.test.ts tests/unit/relays/relay-client-hardening.test.ts
pnpm test -- tests/unit/relays/relay-client-queue.test.ts tests/unit/relays/subscription-manager-read-limiter.test.ts
pnpm test -- tests/unit/timeline/timeline-runtime-close.test.ts tests/unit/timeline/timeline-runtime-route-discovery.test.ts
pnpm test -- tests/unit/events/relay-page.test.ts tests/unit/events/relay-feed-groups.test.ts tests/unit/search/search-query.test.ts tests/unit/relays/relay-info.test.ts tests/unit/relays/relay-discovery.test.ts
pnpm test -- tests/unit/workspace/tab-retention.test.ts tests/unit/settings/settings-store.test.ts tests/unit/log/app-log.test.ts
pnpm test:e2e -- tests/e2e/tab-retention.spec.ts tests/e2e/settings-tab.spec.ts tests/e2e/heavy-feed-memory.spec.ts
pnpm verify
pnpm test:e2e
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e cloudflare
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
docker compose -f docker-compose.yml run --rm cloudflare
```

Functional memory changes should also cover:

```sh
pnpm test -- tests/unit/relays/relay-message-data.test.ts tests/unit/protocol/messages.test.ts tests/unit/protocol/event.test.ts
pnpm test -- tests/unit/events/repository.test.ts tests/unit/events/relay-page-scan-hardening.test.ts
pnpm test -- tests/unit/notifications/notification-runtime.test.ts tests/unit/notifications/notification-window.test.ts
pnpm test -- tests/unit/memory/scored-retention.test.ts tests/unit/repo-source-classes.test.ts
pnpm test -- tests/unit/custom-request/parse.test.ts tests/unit/settings/settings-store.test.ts tests/unit/events/content-tokens.test.ts
pnpm test:e2e -- tests/e2e/heavy-feed-memory.spec.ts tests/e2e/memory-churn.spec.ts --workers=1
```

Memory churn verification uses signed synthetic Nostr events and the synthetic
relay helper. App JavaScript heap is the owned assertion; Chromium RSS is
diagnostic only.

Subscription orchestration changes must also run:

```sh
pnpm vitest run tests/unit/relays/orchestration
pnpm test:e2e -- tests/e2e/subscription-lease-sharing.spec.ts tests/e2e/subscription-pane-churn.spec.ts
```

Acceptance criteria (synthetic relay):

- Active WebSocket count stays at or below enabled relay count.
- Bootstrap leases close on `EOSE` (`bootstrapLeases` returns to zero).
- Two visible Home tabs with the same account and relays share one live lease.
- After closing all feed tabs, `activeLeases`, `activeDemands`, and `liveLeases`
  are zero in `__lkjstrMemoryDebug()`.

Focused startup diagnostics changes must also run:

```sh
pnpm check:repo
pnpm test -- tests/unit/log/app-log.test.ts tests/unit/backend/home/home-query-registry.test.ts
pnpm test:e2e -- tests/e2e/root-workspace.spec.ts
pnpm verify:quiet
```

Acceptance criteria:

- Startup runtime `start()` rejections produce one bounded lkjstr Log row and
  no unhandled promise noise.
- Clean Playwright root startup has no page error, no unhandled rejection, and
  no app-origin SES lockdown console signal.
- The external `lockdown-install.js` plus `SES_UNCAUGHT_EXCEPTION` plus null
  payload case is suppressed; app-origin null and non-null cases are logged.

Final release verification for this class of change is:

```sh
pnpm check:repo
pnpm verify
pnpm test:e2e
pnpm cloudflare:dry-run
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e cloudflare
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
docker compose -f docker-compose.yml run --rm cloudflare
```

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
