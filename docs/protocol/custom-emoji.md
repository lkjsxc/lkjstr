# Custom Emoji

## Purpose

Custom emoji rules keep incoming NIP-30 rendering interoperable while preserving
stricter local shortcode creation.

## Contract

- Incoming NIP-30 `emoji` tags accept case-sensitive shortcodes matching
  `[A-Za-z0-9_-]`.
- Manual lkjstr fields that create new local shortcodes accept only
  `[A-Za-z0-9_]`.
- Emoji image URLs must be HTTPS.
- Optional emoji-set addresses use `30030:<pubkey>:<d>` and are preserved when
  present.
- Unknown shortcode tokens remain visible text.
- Invalid tags remain text and do not create image loads.
- Image load failure falls back to visible `:shortcode:` text without a
  placeholder image.
- Inline custom emoji render at normal text emoji height, preserve intrinsic
  aspect ratio, and cap width at `6em`.
- Emoji picker buttons keep custom emoji images inside the compact button
  bounds.
- Sensitive hidden content does not load custom emoji images until revealed.
- Event content, nested reposts, references, profile names, profile about text,
  reaction summaries, composer insertion, picker choices, and publish helpers
  use parsed NIP-30 tags rather than fake preview data.

## NIP-51 Source Rules

- The active account emoji source uses the newest kind `10030` emoji list.
- Referenced kind `30030` emoji sets are loaded newest-first by address.
- Emoji read from a kind `30030` set receives a synthesized
  `30030:<pubkey>:<d>` address when its member tag omits one.
- Picker and publish resolution dedupe by shortcode, with explicitly selected
  draft emoji taking precedence over the account source.
- Publishing emits exactly one matching `emoji` tag per used shortcode.
