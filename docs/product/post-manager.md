Owner: Product
State: Canon

# Post Manager

## Purpose

The post manager is a local-first tree for drafts, replies, publish state, and
published event references.

## Contract

- The Posts tab requires an active account for draft ownership.
- Without an active account, it shows an account-required state.
- Users can create root drafts and reply drafts.
- Draft title and content edits persist locally.
- Drafts are never deleted by automatic cache pruning.
- The tab renders tree hierarchy with collapse and expand state.
- Nodes show kind, local status, publish state, and failed publish details.
- Published event nodes can open Thread tabs.
- Target author nodes can open Profile tabs.
- Publishing requires a signer account and selected write relays.

## Acceptance

- A draft can be created, edited, reloaded, duplicated, and archived.
- The tree renders parent and child drafts.
- Read-only accounts can draft but cannot publish.
- Unsupported publish actions are disabled with a concrete prerequisite.
