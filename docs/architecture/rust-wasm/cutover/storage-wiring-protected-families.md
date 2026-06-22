# Protected Storage Families

## Purpose

This file owns protected and workspace storage family source maps split from [storage-wiring-families.md](storage-wiring-families.md).

## Storage Families

### Accounts and active selector

- Current TypeScript path: `repositories/accounts-store.ts`,
  `sqlite-opfs/accounts-sqlite.ts`, and old `lkjstr.activeAccountId` key.
- Rust storage and web path: `lkjstr-storage/src/accounts.rs`,
  `active_account.rs`, `lkjstr-web/src/sqlite_store/accounts.rs`, and
  `active_account.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `accounts_test.rs`, `active_account_test.rs`, and
  Accounts host tests.
- Deletion condition: Leptos Accounts owns local, read-only, NIP-07, selector
  migration, and no TypeScript imports.

### Local signing secrets

- Current TypeScript path: `repositories/secrets-store.ts` and
  `sqlite-opfs/accounts-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/local_secrets.rs` and
  `sqlite_store/accounts.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `accounts_test.rs`.
- Deletion condition: protected and unprotected signer records have Rust UI,
  redaction, migration, and tests.

### Settings

- Current TypeScript path: `repositories/settings-store.ts` and
  `sqlite-opfs/settings-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/settings*.rs` and
  `sqlite_store/settings.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `settings_schema_test.rs` and `settings_test.rs`.
- Deletion condition: Settings side effects and flat editor are Rust-owned.

### Relay sets

- Current TypeScript path: `repositories/relay-sets-store.ts` and
  `sqlite-opfs/relay-sets-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/relay_sets.rs` and
  `sqlite_store/relay_sets.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `relay_sets_test.rs`.
- Deletion condition: Relay Settings reads, writes, defaults, and diagnostics
  are Rust-owned.

### Workspace layout

- Current TypeScript path: `repositories/workspace-store.ts` and
  `sqlite-opfs/workspace-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/workspace.rs` and
  `sqlite_store/workspaces.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `workspace_test.rs`.
- Deletion condition: root Rust shell restores, persists, and recovers from
  worker failure.

### Tab snapshots

- Current TypeScript path: `repositories/tab-states-store.ts` and
  `sqlite-opfs/tab-states-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/tab_state.rs` and
  `sqlite_store/tab_states.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `tab_state_test.rs`.
- Deletion condition: all Leptos tabs serialize bounded snapshots and no Svelte
  tab store imports remain.

### Tweet drafts

- Current TypeScript path: `repositories/tweet-drafts-store.ts` and
  `sqlite-opfs/tweet-drafts-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/tweet_drafts.rs` and
  `sqlite_store/tweet_drafts.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `tweet_drafts_test.rs`.
- Deletion condition: Rust Tweet editor owns drafts and publish queue handoff.

### Jobs

- Current TypeScript path: `repositories/jobs-store.ts` and
  `sqlite-opfs/jobs-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/jobs.rs` and
  `sqlite_store/jobs.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `diagnostics_sqlite_rows_test.rs`.
- Deletion condition: publish, upload, retention, and repair jobs are Rust-owned
  and Stats-visible.

### Route blocks

- Current TypeScript path: `repositories/route-blocks-store.ts` and
  `sqlite-opfs/relay-cache-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/route_blocks.rs` and
  `sqlite_store/relay_routes.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `diagnostics_sqlite_rows_test.rs`.
- Deletion condition: relay routing ignores blocked routes through Rust planners
  only.
