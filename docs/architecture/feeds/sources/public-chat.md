# Public Chat Source

## Purpose

Public Chat source rules define ordering, pagination, and coverage for NIP-28
channel chat reads.

## Source Shape

Public Chat is feed-like because it reads relay events into a tab-owned runtime,
but it is not a standard reverse-chronological note feed. It has two linked
streams:

- Channel discovery from kind `40` creation events and kind `41` metadata.
- Selected-channel messages from kind `42` events.

## Channel Discovery Order

Channels sort by newest meaningful activity first:

1. Most recent known message timestamp when messages are loaded for a channel.
2. Most recent metadata update timestamp.
3. Channel creation timestamp.
4. Lexical channel id as a deterministic tie breaker.

The list never invents channels. A channel can appear only after a real kind
`40` event is known.

## Message Order

Selected-channel messages render in chat order:

1. Oldest `created_at` first.
2. Lexical event id as a deterministic tie breaker.

Out-of-order relay arrival must not change this rule. Hidden and muted rows stay
in the ordered list as compact states.

## Pagination

- Channel discovery uses a bounded newest-first limit.
- Selected-channel initial load uses a bounded newest window and then renders it
  oldest first.
- Older message pagination requests events older than the earliest loaded
  message timestamp.
- Pagination keeps relay coverage status per bounded window.

## Coverage

- Selected read relays are the default discovery route.
- Channel relay hints are targeted routes and are capped before use.
- Relay coverage is explicit for channel discovery and selected-channel message
  windows.
- Incomplete coverage, failed relays, or capped relay hints never prove absence.

## Related

- [README.md](README.md).
- [../../runtimes/public-chat-runtime.md](../../runtimes/public-chat-runtime.md).
- [../../../product/feeds/public-chat.md](../../../product/feeds/public-chat.md).
