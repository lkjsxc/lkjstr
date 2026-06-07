# Scope

## Purpose

Scope defines what lkjstr currently promises.

## Included

- Browser-first SvelteKit workspace at `/`.
- Recursive split tiles with persisted layout.
- Home, Tweet, Notifications, Search, Global, Public Chat, Profile Edit,
  Accounts, Relay Settings, Stats, Settings, Upload Settings, lkjstr Log, Mine
  npub, and Welcome from New Tab.
- Profile, Followees, User Timeline, and Thread tabs from identity, event,
  quote, and reference actions.
- SQLite OPFS worker storage for workspace, events, accounts, relay sets,
  settings, notifications, composer recovery data, and cache metadata.
- NIP-07 and local-key text note publishing, replies, reposts, reactions, zaps,
  custom emoji, sensitive content, and media uploads.
- CPU-only `npub` prefix mining with export-only secret handling.

## Excluded

- Server-side account custody.
- Hidden relay fallback after user relay edits.
- Draft-planning workspace tabs.
- New Tab free-form profile, thread, or filter JSON inputs.
