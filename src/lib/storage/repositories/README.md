# Storage Repositories

This directory owns feature-facing access to browser-owned storage tables.
Feature modules call these functions instead of reaching into Dexie directly.

## Protected Stores

- `accounts-store.ts`: account records.
- `secrets-store.ts`: local account signing secrets.
- `settings-store.ts`: flat setting overrides.
- `tweet-drafts-store.ts`: protected Tweet drafts.
- `workspace-store.ts`: durable workspace layout.
- `relay-sets-store.ts`: relay set configuration.
- `route-blocks-store.ts`: protected relay route blocks.

These modules preserve the existing safe-storage behavior: reads use bounded
fallbacks, writes remain best-effort at the feature edge, and protected data
is never connected to cache compaction.
