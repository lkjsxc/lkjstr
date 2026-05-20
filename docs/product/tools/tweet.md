# Tweet

## Purpose

Tweet is the single note authoring surface.

## Contract

- Tweet opens from New Tab.
- Draft content is durable in IndexedDB.
- Publishing requires an active NIP-07 account and browser signer.
- Publishing targets enabled write relays in the selected default relay set.
- The tab shows concrete missing-account, missing-signer, and missing-relay
  prerequisites.
- Empty content without uploaded media cannot publish.
- `Ctrl+Enter` in the editor uses the same disabled rules as the Publish
  button.
- Paste and file-picker uploads use the configured NIP-96 HTTPS upload server.
- A blank upload server disables media upload without blocking text publishing.
- Successful uploads append the media URL to note content and publish matching
  `imeta` tags.
- Tweet does not store private key material, bypass relay settings, or bundle a
  public media host.
