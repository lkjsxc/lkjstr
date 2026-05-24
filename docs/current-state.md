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
- [architecture/data/bounded-memory.md](architecture/data/bounded-memory.md):
  relay, cache, tab, and runtime memory bounds.
- [architecture/workspace/tab-runtime.md](architecture/workspace/tab-runtime.md):
  tab lifecycle, retention, and startup recovery.
- [architecture/network/job-manager.md](architecture/network/job-manager.md):
  persisted job trees, hydration, stale startup marking, and cancellation.
- [architecture/network/relay-pool.md](architecture/network/relay-pool.md):
  relay frame limits, diagnostics, request scheduling, reconnect, and pool
  ownership.
- [architecture/network/relay-routing.md](architecture/network/relay-routing.md):
  route sources, discovery relay scope, and profile relay targeting.
- [architecture/data/relay-pages.md](architecture/data/relay-pages.md):
  adaptive relay segment scanning, density handling, and safe cursors.
- [operations/verification.md](operations/verification.md): local verification
  commands.
- [operations/docker.md](operations/docker.md): Docker Compose verification.
- [operations/cloudflare-workers.md](operations/cloudflare-workers.md):
  Cloudflare Workers dry-run hosting target.

## Gaps

- Relay support determines whether NIP-50 search returns remote matches.
- Relay AUTH remains diagnostic-only.
- Cloudflare Workers is a verified hosting target only; it does not add a
  backend account service, relay proxy, or Cloudflare storage dependency.
- Broad worker queue instrumentation is limited to persisted job records and
  runtime counters.
- Passkey-protected local secret storage has a security design only; local
  signing secrets still use the raw local secret table.
- Broad runtime instrumentation is not automatic; only explicitly job-backed
  flows appear in the job tree.
