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
- [operations/cloudflare-workers.md](operations/cloudflare-workers.md):
  Cloudflare Workers dry-run hosting target.

## Gaps

- Relay support determines whether NIP-50 search returns remote matches.
- Cloudflare Workers is a verified hosting target only; it does not add a
  backend account service, relay proxy, or Cloudflare storage dependency.
- Broad worker queue instrumentation is limited to persisted job records.
- Passkey-protected local secret storage has a security design only; local
  signing secrets still use the raw local secret table.
- Broad runtime instrumentation is not automatic; only explicitly job-backed
  flows appear in the job tree.
