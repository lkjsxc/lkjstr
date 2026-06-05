# Upload Settings

## Purpose

Upload Settings is the guided media upload configuration surface.

## Current Behavior

- Upload Settings opens from New Tab.
- The tab edits `tweet.mediaUploadProvider`, `tweet.mediaUploadCustomServer`,
  and `tweet.mediaUploadNoTransform`.
- Provider choices are Disabled, Blossom custom server, nostr.build NIP-96,
  Nostrcheck NIP-96, void.cat NIP-96, and Custom NIP-96.
- Missing or invalid saved provider ids resolve to Blossom.
- Explicit Disabled remains a saved off state.
- Blossom and Custom NIP-96 use the custom server input, which accepts blank or
  HTTPS URLs only.
- Blank custom server disables custom media upload without blocking text notes.
- The tab shows the resolved upload endpoint for the selected provider.
- Test discovery describes the selected protocol: Blossom raw upload endpoint or
  NIP-96 discovery.
- Changes dispatch the shared settings-changed event so open Tweet and Profile
  Edit tabs use new upload behavior without reload.

## Rust Conversion Status

- The Rust/WASM shell renders Upload Settings from real IndexedDB `settings`
  overrides.
- Rust Upload Settings edits `tweet.mediaUploadProvider`,
  `tweet.mediaUploadCustomServer`, and `tweet.mediaUploadNoTransform`.
- Rust Upload Settings validates blank or HTTPS custom servers and resolves the
  selected provider server.
- Rust Upload Settings discovery reports either a Blossom endpoint or NIP-96
  discovery result for the selected provider.
- Successful Rust Upload Settings saves dispatch the shared
  `lkjstr-settings-changed` browser event.
- Rust Upload Settings does not yet upload files, sign upload auth, or own
  Tweet/Profile Edit media consumers; those flows remain owned by the shipped
  Svelte runtime until the writing surfaces are converted.
