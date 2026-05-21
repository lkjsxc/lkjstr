# Tool Surfaces

## Purpose

Tool surfaces cover local state, writing, relay management, and diagnostics.

## Tree

- [accounts.md](accounts.md): account records and signers.
- [cache.md](cache.md): local cache tab behavior.
- [event-actions.md](event-actions.md): row action writes.
- [relay-management.md](relay-management.md): relay settings and logs.
- [settings.md](settings.md): flat key-value settings.
- [tweet.md](tweet.md): draft and publish behavior.
- [upload-settings.md](upload-settings.md): guided media upload settings.

## Shared Contract

- Tool rows wrap long labels, values, URLs, keys, and status text.
- Relay Settings is the only editable relay surface.
- lkjstr Log is read-only and current-session only.
- Upload Settings edits the same `tweet.*` records as Settings.
