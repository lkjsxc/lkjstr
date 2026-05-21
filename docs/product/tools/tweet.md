# Tweet

## Purpose

Tweet is the single note authoring surface.

## Contract

- Tweet opens from New Tab.
- Draft content is durable in IndexedDB.
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
- Drafts persist custom emoji attachments entered as
  `:shortcode:https://...`. Publishing emits NIP-30 `emoji` tags only for
  attached shortcodes used in the note body.
- Paste and file-picker uploads use the configured NIP-96 HTTPS upload server.
- Each Tweet tab owns a unique visually hidden file input behind an accessible
  icon button, so file selection is scoped to the active composer.
- A blank upload server disables media upload without blocking text publishing.
- Upload provider setting changes apply to an open Tweet tab without recreating
  the tab.
- Successful uploads append the media URL to note content and publish matching
  `imeta` tags.
- Publishing derives profile mention, event mention, quote, and custom emoji
  tags from the note body without duplicating existing media or warning tags.
- Publish controls show active work and confirmed relay counts instead of a
  generic published message.
- Tweet does not bypass relay settings or bundle a public media host.
