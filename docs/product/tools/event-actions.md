# Event Actions

## Purpose

Event actions define the row-level write controls available on feed events.

## Contract

- Event rows expose Heart, Repost, Reply, Zap, and Emoji controls.
- Clicking an action does not open the row thread.
- Heart publishes a NIP-25 kind `7` reaction with content `+`.
- Emoji publishes a NIP-25 kind `7` reaction with typed Unicode content.
- Custom emoji shortcode reactions include the NIP-30 `emoji` tag.
- Repost publishes NIP-18 kind `6` for kind `1` notes.
- Repost publishes kind `16` with `k` tags for non-kind `1` events.
- Reply opens an inline composer under the event, supports `Ctrl+Enter`, and
  publishes a tagged kind `1` reply.
- Zap opens an inline amount/message form, signs a NIP-57 kind `9734` request,
  fetches an invoice, then exposes a `lightning:` payment URI.
