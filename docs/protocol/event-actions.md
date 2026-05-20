# Event Actions

## Purpose

Protocol event actions define write event construction for feed controls.

## Contract

- Reply tags follow NIP-10 with root and reply `e` markers plus relevant `p`
  tags.
- Heart and emoji reactions follow NIP-25 kind `7` target tags.
- Custom emoji reactions follow NIP-30 by using shortcode content and an
  `emoji` tag containing shortcode and image URL.
- Kind `1` reposts use NIP-18 kind `6`.
- Generic reposts use kind `16` and include `k` tags for reposted event kinds.
- Zap requests use NIP-57 kind `9734`.
- HTTP upload auth uses NIP-98 kind `27235`.
