# Agent Instructions

## Purpose

This file defines repository instructions for automated coding agents.

## Contract

lkjstr is a docs-first SvelteKit Nostr workspace. Keep docs and implementation
aligned in the same change, keep source files under 200 lines, keep docs under
300 lines, and avoid release shorthand wording in docs.

## Product Rules

- The root route renders the workspace app.
- Tiles have a tab strip, plus button, tile menu, and persistent resize state.
- New Tab offers Welcome, Home, Global, Relay Settings, lkjstr Log,
  Notifications, Accounts, Mine npub, Tweet, Profile Edit, Settings, and Cache.
- Profile tabs open from identity clicks. Profile Edit opens for active-account
  metadata editing. Thread tabs open from event clicks.
- Settings are one flat key-value list.
- Home, Global, Notifications, Profile, and Thread reads use the selected
  default relay set. Tweet writes use enabled write relays in that set.
- Partial relay failure stays diagnostic and must not block reachable relays.
- Disabled or removed relays are excluded until the user enables or restores
  them.
- Docker checks build images and do not mount the source tree.

## Source Map

- `src/lib/protocol`: Nostr event, filter, tag, and relay URL contracts.
- `src/lib/workspace`: layout, tab, split, recovery, and persistence commands.
- `src/lib/relays`: relay set storage, clients, and pool behavior.
- `src/lib/timeline`, `src/lib/profile`, `src/lib/thread`: read runtimes.
- `src/lib/tweet`: durable drafts and NIP-07 publish helpers.
- `src/lib/tabs`: tab-owned Svelte surfaces.

## Verification

Run focused checks after edits and `pnpm verify` before handoff when practical.
Use synthetic relay tests for network behavior and Playwright for workspace
flows.
