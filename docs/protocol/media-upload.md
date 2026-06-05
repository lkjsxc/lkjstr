# Media Upload

## Purpose

Media upload docs define the provider model for Tweet and Profile Edit
attachments. Blossom/NIP-B7 is the preferred target; NIP-96 remains a separated
compatibility provider while real users still configure those servers.

## Current Behavior

- Upload settings use `tweet.mediaUploadProvider`,
  `tweet.mediaUploadCustomServer`, and `tweet.mediaUploadNoTransform`.
- Implemented transport is NIP-96 with NIP-98 exact-request auth.
- Provider ids are `disabled`, `nostr-build`, `nostrcheck`, `void-cat`, and
  `custom`.
- Built-in providers map to fixed HTTPS NIP-96 origins.
- `custom` uses `tweet.mediaUploadCustomServer`, which must be blank or HTTPS.
- The client discovers `/.well-known/nostr/nip96.json` from the configured
  HTTPS server and falls back to the configured endpoint when discovery is not
  available.
- A valid discovered `api_url` is preferred as the upload endpoint.
- `delegated_to_url` is followed with a loop guard only when no valid `api_url`
  exists.
- Upload requests are multipart `POST` requests with the file in a `file` part.
- `tweet.mediaUploadNoTransform` sends a no-transform request field for NIP-96.
- Successful responses are parsed for a media URL and NIP-94 metadata tags.
- Published notes append uploaded media URLs to content and include matching
  `imeta` tags.

## Target Behavior

- Add a `blossom` provider id that uses `tweet.mediaUploadCustomServer` as the
  user-owned HTTPS Blossom server.
- Blossom upload computes SHA-256 before sending, signs a scoped auth event,
  sends a raw blob upload to the configured server, and validates the returned
  descriptor hash.
- Blossom descriptors normalize into the same attachment shape as NIP-96:
  media URL, NIP-94-style tags, and one `imeta` tag.
- NIP-96 providers stay labeled as compatibility choices in UI and docs.
- Upload auth signs only the exact method, URL, and hash required by the chosen
  provider.
- Missing upload configuration disables media upload without blocking text-only
  publishing.

## Invariants

- Upload is never automatic on file selection without explicit composer action.
- Failed upload never marks Tweet publish as successful.
- Upload responses are untrusted and must be shape-checked before use.
- Local file paths are never logged or sent.
- Profile Edit uses the same uploader as Tweet for picture and banner URL
  fields.

## Source Map

- `src/lib/media/`: provider ids, endpoint resolution, upload transports, and
  settings loading.
- `src/lib/tweet/media-upload.ts`: Tweet attachment adapter.
- `src/lib/protocol/nip96.ts`: NIP-96 discovery and response parsing.
- `src/lib/protocol/http-auth.ts`: NIP-98 authorization events.
- `tests/unit/media/media.test.ts`: provider, discovery, and transport tests.
- `docs/product/tools/upload-settings.md`: guided settings surface.

## Acceptance Checks

- `pnpm test -- tests/unit/media/media.test.ts`
- `pnpm test -- tests/unit/protocol/event-builders.test.ts`
- `pnpm check:repo`
