# Media Upload

## Purpose

Media upload docs define the NIP-96 and NIP-98 contract for Tweet attachments.

## Contract

- Uploads use `tweet.mediaUploadProvider`, `tweet.mediaUploadCustomServer`,
  and `tweet.mediaUploadNoTransform`.
- Provider ids are `disabled`, `nostr-build`, `nostrcheck`, `void-cat`, and
  `custom`.
- Built-in providers map to fixed HTTPS NIP-96 origins. `custom` uses
  `tweet.mediaUploadCustomServer`, which must be blank or HTTPS.
- `tweet.mediaUploadServer` is not an active setting contract.
- The client discovers `/.well-known/nostr/nip96.json` unless the configured
  URL already points to a NIP-96 API endpoint.
- `delegated_to_url` is followed when present.
- Each upload signs a NIP-98 kind `27235` HTTP auth event with the active local
  or NIP-07 signing account.
- Upload requests are multipart `POST` requests with the file in a `file` part.
- `tweet.mediaUploadNoTransform` sends a no-transform request field.
- Successful responses are parsed for a media URL and NIP-94 metadata tags.
- Published notes append uploaded media URLs to content and include matching
  `imeta` tags.
- Composer upload uses the file picker or paste. Bundled preset uploads are not
  part of the product flow.
