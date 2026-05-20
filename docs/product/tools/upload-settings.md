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
