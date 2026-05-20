# Storage

## Purpose

Storage docs define browser persistence ownership.

## Stores

- `workspaces`: workspace layout and tab state.
- `accounts`: account metadata.
- `notifications`: local activity records.
- `tweetDrafts`: durable Tweet drafts.
- `events`: cached Nostr events.
- `eventTags`: searchable `e` and `p` tag rows for bounded feed queries.
- `settings`: settings overrides.
- `relaySets`: editable relay sets.

## Contract

Local signing secrets are stored in a dedicated IndexedDB table separate from
public account records. Account listing APIs return public account metadata
only. NIP-07 signing stays in the browser signer boundary.

## Cleanup

Event cache cleanup may prune cached events, event relay receipts, event tag
rows, and feed cursors. It must not prune accounts, settings, relay sets,
workspace layout, notifications, or Tweet drafts.
