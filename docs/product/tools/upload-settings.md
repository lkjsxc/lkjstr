# Upload Settings

## Purpose

Upload Settings is the guided media upload configuration surface.

## Contract

- Upload Settings opens from New Tab.
- The tab edits `tweet.mediaUploadProvider`, `tweet.mediaUploadCustomServer`,
  and `tweet.mediaUploadNoTransform`.
- Provider choices are Disabled, nostr.build, Nostrcheck, void.cat, and Custom.
- Missing or invalid saved provider ids resolve to nostr.build.
- Explicit Disabled remains a saved off state.
- Custom server input accepts blank or HTTPS URLs only.
- The tab shows the resolved upload endpoint for the selected provider.
- Test discovery performs real NIP-96 discovery and reports success or failure.
- Changes dispatch the shared settings-changed event so open Tweet and Profile
  Edit tabs use new upload behavior without reload.

## Rust Conversion Status

- The Rust/WASM shell renders Upload Settings from real IndexedDB `settings`
  overrides.
- Rust Upload Settings edits `tweet.mediaUploadProvider`,
  `tweet.mediaUploadCustomServer`, and `tweet.mediaUploadNoTransform`.
- Rust Upload Settings validates blank or HTTPS custom servers, resolves the
  selected provider endpoint, and runs real NIP-96 discovery through browser
  `fetch`.
- Successful Rust Upload Settings saves dispatch the shared
  `lkjstr-settings-changed` browser event.
- Rust Upload Settings does not yet upload files, sign NIP-98 upload auth, or
  own Tweet/Profile Edit media consumers; those flows remain owned by the
  existing runtime until the writing surfaces are converted.
