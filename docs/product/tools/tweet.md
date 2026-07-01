# Tweet

## Purpose

Tweet is the single note authoring surface.

## Rust Conversion Status

Status: partial.

The Rust/WASM shell renders a real Tweet draft editor. The Svelte product path
stores drafts through the SQLite worker. The editor loads `tab:{tabId}` drafts, falls back
to the `main` draft when a tab draft is absent, saves content immediately,
saves the sensitive flag plus warning reason, and reports storage failures as
unavailable state.

Rust publishing, media upload, custom emoji source lookup, active-account
selection, signing, relay queueing, and post-publish clearing are not
implemented yet. The Rust editor must not display fake relay success, fake media
uploads, or fake custom emoji metadata.

## Contract

- Tweet opens from New Tab.
- Draft content is durable through the SQLite worker when browser Workers are
  available, with in-memory fallback when storage is unavailable.
- Publishing, draft `accountId`, and upload authentication use the active
  signing account.
- Publishing targets enabled write relays in the selected default relay set.
- The tab shows concrete missing-account, missing-signer, and missing-relay
  prerequisites.
- Empty content without uploaded media cannot publish.
- `Ctrl+Enter` and `Command+Enter` in the editor use the same disabled rules
  as the Publish button through the shared shortcut helper.
- Drafts persist a sensitive-content flag and optional reason. Publishing a
  sensitive draft adds a `content-warning` tag with the reason when present.
- The composer uses a stable footer region. Attachment previews, upload
  progress, upload errors, and long media URLs render above the footer and may
  wrap or scroll without changing the Publish button position.
- The toolbar places media and emoji buttons together and keeps Publish aligned
  right in a stable-width publish area.
- Focus order remains editor, media control, emoji control, then Publish.
- Unicode emoji selection inserts at the textarea cursor.
- Custom emoji selection inserts `:shortcode:` at the cursor and persists that
  emoji in draft state. Manually typed valid `:shortcode:` tokens resolve only
  against the loaded active-account emoji source at publish time. Publishing
  emits exactly one NIP-30 `emoji` tag for each used shortcode.
- Custom emoji choices come from the active account's newest kind `10030` emoji
  list, direct `emoji` tags, and referenced newest kind `30030` emoji sets
  discovered from cache first and then selected read relays.
- Paste and file-picker uploads use the configured HTTPS media provider.
  Blossom is the preferred provider; NIP-96 providers are compatibility
  choices.
- Media upload rejects empty files, unsupported MIME types, and files over
  104857600 bytes before signing or network upload.
- Each Tweet tab owns a unique visually hidden file input behind an accessible
  icon button, so file selection is scoped to the active composer.
- A blank upload server disables media upload without blocking text publishing.
- When upload is not configured, Tweet shows `Configure media upload in Upload
Settings.` and opens Upload Settings on click instead of failing silently on
  the attach control.
- Upload provider setting changes apply to an open Tweet tab without recreating
  the tab.
- Successful uploads append the media URL to note content and publish matching
  `imeta` tags.
- Publishing derives profile mention, event mention, quote, and custom emoji
  tags from the note body without duplicating existing media or warning tags.
- Publish controls show active signing work and always exit that state with a
  signed event, denied/unavailable signer, no-write-relay, relay failure, or
  storage-busy draft/archive diagnostic. Text-only publishing does not require
  media upload settings.
- After signing and relay queueing succeed, Tweet clears content, media, custom
  emoji, sensitive state, tab draft and old `main` draft, then focuses the
  editor. If local archive fails after signing, Tweet keeps relay delivery alive
  and shows an archive warning instead of a generic publish failure. Late
  diagnostics are shown only when every relay rejects the event or relay
  publishing fails.
- Tweet does not bypass relay settings or bundle a public media host.

## Layout Acceptance

- The Publish button bounding rectangle stays stable before and after attaching
  one image, multiple images, an upload error, and a long media URL.
- Stability tolerance is only for sub-pixel browser rounding.
- `Ctrl+Enter` and `Command+Enter` use the same disabled rules as clicking the
  stable Publish button.
