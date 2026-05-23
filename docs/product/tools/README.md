# Tool Surfaces

## Purpose

Tool surfaces cover local state, writing, relay management, and diagnostics.

## Tree

- [accounts.md](accounts.md): account records and signers.
- [author-context.md](author-context.md): nearby posts by an event author.
- [cache.md](cache.md): local cache tab behavior.
- [custom-request.md](custom-request.md): validated one-shot relay reads.
- [event-actions.md](event-actions.md): row action writes.
- [profile-edit.md](profile-edit.md): active-account metadata writes.
- [relay-management.md](relay-management.md): relay settings and logs.
- [search.md](search.md): local and relay-backed search.
- [settings.md](settings.md): flat key-value settings.
- [tweet.md](tweet.md): draft and publish behavior.
- [upload-settings.md](upload-settings.md): guided media upload settings.

## Shared Contract

- Tool rows wrap long labels, values, URLs, keys, and status text.
- Relay Settings is the only editable relay surface.
- lkjstr Log is read-only and current-session only.
- Upload Settings edits the same `tweet.*` records as Settings.
- Search, Custom Request, Profile Edit, and Author Context render existing
  shared rows and controls instead of owning separate event presentation rules.
