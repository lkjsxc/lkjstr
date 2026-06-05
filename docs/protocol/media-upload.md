# Media Upload

## Purpose

Media upload docs define the provider model for Tweet and Profile Edit
attachments. Blossom/NIP-B7 is the preferred provider model. NIP-96 remains a
separated compatibility provider while real users still configure those servers.

## Current Behavior

- Upload settings use `tweet.mediaUploadProvider`,
  `tweet.mediaUploadCustomServer`, and `tweet.mediaUploadNoTransform`.
- Provider ids are `disabled`, `blossom`, `nostr-build`, `nostrcheck`,
  `void-cat`, and `custom`.
- Missing or invalid saved provider ids resolve to `blossom`.
- `blossom` and `custom` use `tweet.mediaUploadCustomServer`, which must be
  blank or HTTPS.
- `blossom` treats an HTTPS origin as `/upload` and accepts an explicit HTTPS
  upload endpoint.
- Blossom upload computes SHA-256 before sending, signs a scoped auth event,
  sends a raw `PUT` upload, and validates the returned descriptor hash.
- Blossom descriptors normalize into the shared attachment shape: media URL,
  NIP-94-style tags, and one `imeta` tag.
- NIP-96 compatibility providers map to fixed HTTPS origins or the `custom`
  HTTPS server.
- NIP-96 discovery reads `/.well-known/nostr/nip96.json`, prefers a valid
  `api_url`, and follows `delegated_to_url` with a loop guard only when no valid
  `api_url` exists.
- NIP-96 upload signs a NIP-98 kind `27235` HTTP auth event for the exact
  `POST` endpoint and optional payload hash.
- NIP-96 upload requests are multipart `POST` requests with the file in a
  `file` part and optional no-transform field.
- Successful responses are parsed for a media URL and NIP-94 metadata tags.
- Published notes append uploaded media URLs to content and include matching
  `imeta` tags.

## Invariants

- Upload is never automatic on file selection without explicit composer action.
- Failed upload never marks Tweet publish as successful.
- Upload responses are untrusted and must be shape-checked before use.
- Upload auth signs only the method, URL, and hash scope required by the chosen
  provider.
- Local file paths are never logged or sent.
- Missing upload configuration disables media upload without blocking text-only
  publishing.
- Profile Edit uses the same uploader as Tweet for picture and banner URL
  fields.

## Source Map

- `src/lib/media/providers.ts`: provider ids, labels, protocols, and defaults.
- `src/lib/media/endpoint.ts`: Blossom and NIP-96 endpoint resolution.
- `src/lib/media/upload.ts`: Blossom raw upload and NIP-96 multipart upload.
- `src/lib/protocol/blossom.ts`: Blossom descriptors and scoped upload auth.
- `src/lib/protocol/nip96.ts`: NIP-96 discovery and response parsing.
- `src/lib/protocol/http-auth.ts`: NIP-98 authorization events.
- `src/lib/tweet/media-upload.ts`: Tweet attachment adapter.
- `tests/unit/media/media.test.ts`: provider, discovery, and transport tests.
- `tests/unit/protocol/blossom.test.ts`: Blossom parser and auth tests.
- `docs/product/tools/upload-settings.md`: guided settings surface.

## Acceptance Checks

- `pnpm test -- tests/unit/media/media.test.ts tests/unit/protocol/blossom.test.ts`
- `pnpm test -- tests/unit/protocol/event-builders.test.ts`
- `pnpm check:repo`
