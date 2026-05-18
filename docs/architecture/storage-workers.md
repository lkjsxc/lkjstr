# Storage

## Purpose

Storage docs define browser persistence ownership.

## Stores

- `workspaces`: workspace layout and tab state.
- `accounts`: account metadata.
- `notifications`: local activity records.
- `tweetDrafts`: durable Tweet drafts.
- `events`: cached Nostr events.
- `settings`: settings overrides.
- `relaySets`: editable relay sets.

## Contract

Private keys are not stored by lkjstr. NIP-07 signing stays in the browser
signer boundary.
