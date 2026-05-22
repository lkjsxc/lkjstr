# Event Actions

## Purpose

Protocol event actions define write event construction for feed controls.

## Contract

- Reply tags follow NIP-10 with root and reply `e` markers plus relevant `p`
  tags.
- Heart, dislike, Unicode emoji, and custom emoji reactions follow NIP-25 kind
  `7` target tags and include `e`, `p`, and `k` tags for the target event.
- Custom emoji reactions follow NIP-30 by using shortcode content and an
  `emoji` tag containing shortcode, image URL, and optional kind `30030`
  emoji-set address.
- Kind `1` reposts use NIP-18 kind `6`.
- Generic reposts use kind `16` and include `k` tags for reposted event kinds.
- Zap requests use NIP-57 kind `9734`.
- HTTP upload auth uses NIP-98 kind `27235`.

## Rendering

Action events render through a summary path. Reactions display a readable action
surface instead of raw `+` content, reposts display a repost summary instead of
embedded JSON text, and notifications reuse the same shared event content
renderer.

## Controls

Row action controls use fixed-size icon buttons with accessible labels. Reply,
emoji, and zap controls open compact inline panels without triggering row thread
navigation.

Emoji reactions use the shared picker. Custom emoji reactions retain exactly one
matching `emoji` tag. The shared NIP-30 parser validates case-sensitive
shortcodes with the project rule `[A-Za-z0-9_]`, HTTPS URLs, and optional
`30030:<pubkey>:<d-tag>` addresses.
