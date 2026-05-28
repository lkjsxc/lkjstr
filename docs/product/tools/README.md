# Tool Surfaces

## Purpose

Tool surfaces cover local state, writing, relay management, and diagnostics.

## Table of Contents

- [accounts.md](accounts.md): account records and signers.
- [author-context.md](author-context.md): nearby posts by an event author.
- [cache.md](cache.md): local cache behavior surfaced through Stats and
  settings.
- [custom-request.md](custom-request.md): validated one-shot relay reads.
- [event-actions.md](event-actions.md): row action writes.
- [log.md](log.md): current-session app, relay, and job diagnostics.
- [mine-npub.md](mine-npub.md): vanity local signing key generation.
- [profile-edit.md](profile-edit.md): active-account metadata writes.
- [relay-management.md](relay-management.md): relay settings and logs.
- [search.md](search.md): local and relay-backed search.
- [settings.md](settings.md): flat key-value settings.
- [stats.md](stats.md): relay, cache, job, and runtime summaries.
- [tweet.md](tweet.md): draft and publish behavior.
- [upload-settings.md](upload-settings.md): guided media upload settings.
- [welcome.md](welcome.md): startup readiness status.

## Shared Contract

- Tool rows wrap long labels, values, URLs, keys, and status text.
- Relay Settings is the only editable relay surface.
- lkjstr Log is read-only, current-session only, and does not start relay
  reads.
- Stats is read-only and may refresh current-session snapshots.
- Upload Settings edits the same `tweet.*` records as Settings.
- Search, Custom Request, Profile Edit, and Author Context render existing
  shared rows and controls instead of owning separate event presentation rules.
