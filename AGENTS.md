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
- New Tab offers Home, Tweet, Notifications, Search, Custom Request, Global,
  Profile Edit, Accounts, Relay Settings, Stats, Settings, Upload Settings,
  lkjstr Log, Mine npub, and Welcome.
- Clean startup shows Welcome plus Accounts, Relay Settings, Home,
  Notifications, and Tweet. Storage failure must recover to a usable Welcome
  workspace.
- Profile tabs open from identity clicks. Profile Edit opens for active-account
  metadata editing. Thread tabs open from event clicks.
- Settings are one flat key-value list.
- Selected read relays are the base and fallback for Home, Global,
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
