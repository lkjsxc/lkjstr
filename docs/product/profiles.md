Owner: Product
State: Canon

# Profiles

## Purpose

Profile tabs show Nostr identity metadata and authored notes for one pubkey.

## Contract

- A profile tab accepts hex pubkey, npub, nprofile, or the active account.
- Invalid input stays in New Tab with an inline error.
- Profile metadata loads from cache first.
- Kind `0` metadata from enabled read relays updates the cache.
- Profile notes load from cache and live relays using kind `1` authored by the
  profile pubkey.
- The tab shows avatar, display name, username, NIP-05 when enabled, shortened
  npub, about text, website, relay provenance, and metadata freshness.
- Image loading must not block text rendering.
- Empty states describe missing metadata or missing posts, not future work.
- Profile content is rendered as text or sanitized links.

## Acceptance

- Profile opens from New Tab and from timeline author actions.
- Cached metadata renders before relay updates.
- Unknown pubkeys show a usable empty metadata state.
- Profile posts render without requiring an account.
