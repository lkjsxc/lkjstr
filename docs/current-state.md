# Current State

## Purpose

This document records the current implemented contract for the app.

## State

- Root `/` renders the workspace shell.
- Workspace layout, tab groups, tabs, accounts, relay sets, settings, events,
  notifications, Tweet drafts, and cache metadata are local browser data.
- New Tab opens only Timeline, Relay Settings, Relay Monitor, Notifications,
  Accounts, Tweet, Settings, and Cache.
- Profile tabs are opened from identity actions.
- Thread tabs are opened from event actions.
- Settings render as one flat key-value list.
- Timeline is Account home: active account plus NIP-02 follows from the latest
  kind `3` event.
- Timeline loads cached matching notes first, then subscribes to enabled read
  relays in the selected default relay set.
- Timeline has no public fallback when the selected account or read relays
  cannot produce a feed.
- Timeline loading ends when all active relays report EOSE, including the empty
  event case.
- Timeline states are `no-active-account`, `loading-follows`, `no-follow-list`,
  `no-enabled-relay`, `auth-required`, `subscription-closed`, `relay-failed`,
  `ready-empty`, and `ready-with-events`.
- Timeline and Relay Monitor show relay diagnostics.
- Tweet uses durable draft storage and publishes NIP-07 signed text notes to
  enabled write relays.
- Docker verification uses built images with no bind mounts.

## Gaps

- Relay health is visible from live pool snapshots but is not written back.
- Profile metadata cache is memory-assisted and event-backed.
- Notifications are local records; relay notification subscriptions are not yet
  a dedicated runtime.
