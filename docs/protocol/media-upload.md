# Media Upload

## Purpose

Media upload docs define the NIP-96 and NIP-98 contract for Tweet attachments.

## Contract

- Uploads use only the configured `tweet.mediaUploadServer` setting.
- The setting must be blank or an HTTPS URL.
- The client discovers `/.well-known/nostr/nip96.json` unless the configured
  URL already points to a NIP-96 API endpoint.
- `delegated_to_url` is followed when present.
- Each upload signs a NIP-98 kind `27235` HTTP auth event with NIP-07.
- Upload requests are multipart `POST` requests with the file in a `file` part.
- `tweet.mediaUploadNoTransform` sends a no-transform request field.
- Successful responses are parsed for a media URL and NIP-94 metadata tags.
- Published notes append uploaded media URLs to content and include matching
  `imeta` tags.
