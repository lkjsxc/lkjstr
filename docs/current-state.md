# Current State

## Purpose

This document records the current implemented contract for the app.

## Index

- [product/README.md](product/README.md): implemented workspace, feed, and
  tool behavior.
- [product/workspace/tabs.md](product/workspace/tabs.md): startup tabs, New
  Tab choices, and action-opened surfaces.
- [product/tools/README.md](product/tools/README.md): Accounts, Search, Custom
  Request, Profile Edit, Author Context, Tweet, settings, relays, and logs.
- [protocol/README.md](protocol/README.md): Nostr event, relay, NIP, custom
  emoji, media, and action contracts.
- [architecture/README.md](architecture/README.md): source ownership, runtime
  ownership, storage, workspace, and network boundaries.
- [architecture/data/shared-storage.md](architecture/data/shared-storage.md):
  `NostrEvent` cache shape, relay receipts, tag rows, cursors, and jobs.
- [architecture/workspace/tab-runtime.md](architecture/workspace/tab-runtime.md):
  tab lifecycle, retention, and startup recovery.
- [architecture/network/job-manager.md](architecture/network/job-manager.md):
  persisted job trees, hydration, stale startup marking, and cancellation.
- [operations/verification.md](operations/verification.md): local verification
  commands.
- [operations/docker.md](operations/docker.md): Docker Compose verification.

## Gaps

- Relay support determines whether NIP-50 search returns remote matches.
- Relay latency, last-event-per-relay, worker queue health, event validation
  state, and passkey-protected secret storage are not persisted.
- Broad runtime instrumentation is not automatic; only explicitly job-backed
  flows appear in the job tree.
