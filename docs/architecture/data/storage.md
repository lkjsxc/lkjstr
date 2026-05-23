# Storage

## Purpose

Storage docs define browser persistence ownership.

## Stores

- `workspaces`: workspace layout and tab state.
- `accounts`: account metadata.
- `localAccountSecrets`: raw local signing account secret keys.
- `notifications`: local activity records.
- `tweetDrafts`: durable Tweet drafts.
- `events`: cached Nostr events.
- `eventRelays`: event relay receipts.
- `eventTags`: searchable `e`, `p`, `q`, and `a` tag rows.
- `feedCursors`: feed paging cursors.
- `jobs`: persisted in-app job records.
- `cacheMeta`: cache status records.
- `tabStates`: retained tab state snapshots.
- `settings`: settings overrides.
- `relaySets`: editable relay sets.

## Contract

Local signing secrets are stored in dedicated IndexedDB tables separate from
public account records. Raw local accounts use the local secret table. Account
listing APIs return public account metadata only. NIP-07 signing stays in the
browser signer boundary.

## Cleanup

Event cache cleanup may prune cached events, event relay receipts, event tag
rows, and feed cursors. It must not prune accounts, settings, relay sets,
workspace layout, notifications, or Tweet drafts.
