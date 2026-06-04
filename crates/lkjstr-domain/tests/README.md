# Domain Tests

## Purpose

Domain tests port browser-independent TypeScript behavior into Rust.

## Table of Contents

- `accounts_test.rs`: account records, local signing, and npub mining helpers.
- `feed_lod_test.rs`: feed LOD build, forgetting, scoring, and recovery.
- `new_tab_catalog_test.rs`: New Tab option labels and active-account config.
- `relay_sets_test.rs`: default relay sets and relay settings reducers.
- `tweet_draft_test.rs`: Tweet draft row shape and body detection.
- `upload_settings_test.rs`: media upload provider resolution.
- `workspace_move_test.rs`: tab movement and edge split reducers.
- `workspace_snapshot_test.rs`: tab snapshot capture and merge helpers.
- `workspace_test.rs`: startup workspace, tab commands, splits, and recovery.
