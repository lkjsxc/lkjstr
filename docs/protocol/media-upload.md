# Media Upload

## Purpose

Media upload docs define the NIP-96 and NIP-98 contract for Tweet attachments.

## Contract

- Uploads use `tweet.mediaUploadProvider`, `tweet.mediaUploadCustomServer`,
  and `tweet.mediaUploadNoTransform`.
- Provider ids are `disabled`, `nostr-build`, `nostrcheck`, `void-cat`, and
  `custom`.
- Built-in providers map to fixed HTTPS NIP-96 origins. The default provider
  is `nostr-build`; missing or invalid saved provider ids fall back to that
  provider. Explicit `disabled` remains respected.
- `custom` uses `tweet.mediaUploadCustomServer`, which must be blank or HTTPS.
- `tweet.mediaUploadServer` is not an active setting contract.
- The client discovers `/.well-known/nostr/nip96.json` from the configured
  HTTPS server and falls back to the configured endpoint when discovery is not
  available.
- `delegated_to_url` is followed with a loop guard, and discovered `api_url`
  is preferred as the upload endpoint.
- Each upload signs a NIP-98 kind `27235` HTTP auth event with the active local
  or NIP-07 signing account.
- Upload requests are multipart `POST` requests with the file in a `file` part.
- `tweet.mediaUploadNoTransform` sends a no-transform request field.
- Upload auth may include a payload hash tag when the caller requests one.
- Profile Edit uses the same uploader for picture and banner URL fields.
- Successful responses are parsed for a media URL and NIP-94 metadata tags.
- Published notes append uploaded media URLs to content and include matching
  `imeta` tags.
- Composer upload uses the file picker or paste. Bundled preset uploads are not
  part of the product flow.
