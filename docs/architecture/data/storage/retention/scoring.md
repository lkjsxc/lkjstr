# Retention Scoring

## Purpose

Retention scoring selects lower-value recoverable cache before higher-value or
dynamically protected records.

## Protected Classes

These never evict through score compaction:

- accounts and local signing secrets
- settings
- relay sets and user-owned relay enable or disable state
- Tweet drafts
- workspace layout
- active tab snapshots
- pending or running jobs
- relay route blocks
- latest kind `0` metadata per pubkey
- latest kind `3` follow list per active account pubkey
- runtime-pinned event ids
- newest retained notification window per account
- notifications visible in mounted Notifications surfaces
- feed keys owned by open feed surfaces

## Score Shape

Event scores combine recency, kind, structural source, and direct target value.
Notification scores use account, created time, muted or hidden state, kind, and
visible-surface protection.

Feed scan hints score low, feed coverage scores by proof quality and freshness,
feed cursors score by open-feed ownership, diagnostics score by usefulness, and
finished jobs score below active work.

## Tie Break

When scores tie, keep the newer resource, then the lexicographically greater
ledger id.
