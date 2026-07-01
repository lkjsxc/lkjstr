# Read Availability

## Purpose

This contract defines the typed relay-read availability model used before any
feed or public target surface decides whether to read cache, contact relays, or
show an unavailable state.

## Table of Contents

- [effective-plan.md](effective-plan.md): field-level effective read plan contract.
- [surface-policy.md](surface-policy.md): surfaces allowed to use read-only fallback.

## Availability Records

Relay settings, account selection, and write capability are separate facts.
Product code must not use an empty relay array to mean both "durable settings
loaded with no enabled read relay" and "relay settings storage unavailable."

A read resolver returns plain data:

- `source`: `durable-settings`, `durable-empty`, `session-default-public-read`,
  or `settings-unavailable`.
- `relays`: normalized real WebSocket URLs. It is empty only for durable-empty
  or unavailable-without-fallback.
- `diagnostic`: absent for durable settings; otherwise the real storage or
  policy reason.
- `writeAllowed`: false for every session-default public read plan.

## Surface Policy

Global, public Profile, Search, Author Context, Followees, public User
Timeline, and Custom Request event-list reads may use session default public
read relays when durable relay settings are unavailable.

Home and Notifications are protected read surfaces. They require a real active
account pubkey. When the page shell supplies that real pubkey but protected
storage or relay settings are unavailable, they may use the same session
default public read relays in read-only mode. The diagnostic must state which
storage fact failed. Signing and write actions stay unavailable until real
signer state and durable enabled write relays exist.

## State Semantics

`no-enabled-relay` means durable relay settings were loaded and the selected
user relay set has no enabled read relay, or the surface policy explicitly
forbids session defaults. It must not be shown merely because relay settings
storage is busy, blocked, unsupported, timed out, or otherwise unavailable.

Cache misses, relay failures, and settings failures do not prove empty feeds.
Empty states require scope-specific cache or relay coverage proof. Partial
relay failures remain diagnostics while reachable relays and cached rows render.
