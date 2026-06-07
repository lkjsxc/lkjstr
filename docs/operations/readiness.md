# Readiness

## Purpose

Readiness checks whether the app contract is shippable.

## Checklist

- Docs and implementation agree.
- New Tab has no retired choices or free-form inputs.
- Settings are flat.
- Relay changes restart active read runtimes.
- Home handles account authors, cached data, EOSE, failed relays, no active
  account, no follow list, auth-required, subscription-closed,
  no-enabled-relay, ready-empty, and ready-with-events.
- Home and Global keep low-level relay diagnostics out of feed bodies while
  preserving high-level errors.
- lkjstr Log exposes current-session relay diagnostics instead of hiding relay
  failures behind public fallback reads.
- Home, Global, Profile, Thread, and Notifications load older pages only after
  near-bottom scroll and keep their documented item windows.
- Cold-cache Home, Global, Profile, and Thread load pre-existing relay history
  from initial pages, not only events published after page load.
- Bottom-scroll and viewport auto-fill repeatedly load older history without
  document-level overflow.
- Reload with cached events keeps row identity rendering stable.
- Media embeds stay within the pane on desktop and mobile.
- Media URLs are hidden from text only when their embed renders.
- Mention tokens open Profile; event entity tokens open Thread.
- Clicking a post opens Thread; clicking avatar or name opens Profile.
- Notifications use a lightweight action context header and canonical source
  event body first. The outer actor chip is hidden only when the source event
  already shows the notification actor; target/root context is fallback-only,
  explicitly labeled, and keeps the outer actor chip.
- Like reactions render as heart reactions, never as `liked`.
- Quote and reference previews are deduped by event id.
- Inactive tab retention keeps switched-away tabs alive for the configured
  grace period and closes subscriptions after expiry.
- Cache compaction protects accounts, settings, relay sets, workspace state,
  Tweet drafts, active jobs, active tab snapshots, recent notification windows,
  and relay route blocks.
- App-owned memory counters return to documented idle states after heavy-feed
  cleanup; Chromium RSS remains manual diagnostic evidence.
- Tweet publishes only with a signing account and enabled write relays.
- Docker config contains no bind mounts.
- Docker Compose config, image build, verify, and focused gates pass when Docker is
  available.
- Unit and focused checks pass for the changed surface.
