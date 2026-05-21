# Scope

## Purpose

Scope defines what lkjstr currently promises.

## Included

- Browser-first SvelteKit workspace at `/`.
- Recursive split tiles with persisted layout.
- Home, Global, Search, Relay Settings, Notifications, Accounts, Tweet, and
  Settings from New Tab.
- Profile and Thread tabs from event actions.
- IndexedDB storage for workspace, events, accounts, relay sets, settings,
  notifications, composer recovery data, and cache metadata.
- NIP-07 text note publishing.
- CPU-only `npub` prefix mining with export-only secret handling.

## Excluded

- Server-side account custody.
- Hidden relay fallback after user relay edits.
- Draft-planning workspace tabs.
- New Tab free-form profile, thread, or filter JSON inputs.
