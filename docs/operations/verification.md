# Verification

## Purpose

Verification commands prove docs, source, unit behavior, build, and browser
flows.

## Local

```sh
pnpm check:repo
pnpm kit:sync
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm test:e2e
pnpm verify:quiet
pnpm test:e2e:quiet
```

## Docker

```sh
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
```

Run all four Docker commands before claiming image-backed verification.

## Gate

Use `pnpm verify` for normal local verification. Use Docker after Compose or
Dockerfile changes and before claiming image-backed verification. CI must run
the same local, browser, and Docker-backed gates.

Quiet commands are preferred in agent runs. They print a short success line
when commands pass and print buffered command output only when a command fails.

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
- Profile renders summary first, then Notes rows in the same Profile tab scroll
  flow at desktop and mobile widths.
- Timeline scroll position remains nonzero after older loads and live prepends
  when the user was not at the top.
- Profile notes render below the profile header without horizontal overflow on
  narrow panes.
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
- Notifications show compact actor/action rows and target/root event previews
  for reactions, reposts, replies, and quotes when the referenced event is
  available.
- Notification records without `targetEventId` or `rootEventId` do not call
  Thread navigation with an empty id.
- Quote and reference previews are deduped by event id.
- Tweet publish clears and focuses the composer after signing/local queueing
  without showing persistent `Sent to` or `Published` success text.
- Inactive feed tabs stay mounted through `tabs.inactiveRetentionSeconds`, then
  close owned subscriptions after expiry.
- Changing `tabs.inactiveRetentionSeconds`, closing a tab, or retention expiry
  removes retained inactive tab bodies and releases owned subscriptions.
- lkjstr Log renders one flat chronological wrapped stream.
- Older cached events without relay arrays render with `cache` provenance.
- In clean Playwright, any SES lockdown console message must be reproduced
  before it is treated as app-origin.

## Memory

The heavy-feed browser smoke test reports app JavaScript heap, runtime item
counters, and total Chromium RSS. The app heap gate is `100 MB`; RSS is
diagnostic because browser baseline memory is outside app control.
