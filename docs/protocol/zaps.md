# Zaps

## Purpose

Zap docs define the NIP-57 invoice handoff used by event actions.

## Contract

- Zap actions require a NIP-07 active account.
- Event zap tags are preferred over profile Lightning identifiers.
- Profile `lud16` and `lud06` are used when event zap tags are absent.
- The client signs a kind `9734` zap request with amount, relays, target event
  or pubkey tags, and an optional message.
- The app fetches the callback invoice and shows a `lightning:` URI.
- The app may open or copy the URI, but it does not store wallet secrets.
