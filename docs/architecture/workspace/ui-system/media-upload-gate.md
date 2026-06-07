# Media Upload Gate

## Purpose

Media upload surfaces must explain when upload is unavailable and route the
user to Upload Settings.

## Canonical Copy

```text
Configure media upload in Upload Settings.
```

All gated surfaces use this exact sentence.

## `UploadGateHint`

- Renders when the configured upload server URL is blank.
- Acts as a button or link-styled control.
- Click opens or focuses Upload Settings in the workspace.
- Does not block text-only publishing.

## Surfaces

### Tweet

- Attach control stays visually present when upload is not configured.
- Clicking attach while unconfigured opens Upload Settings instead of doing
  nothing.
- `UploadGateHint` appears beside the toolbar with the canonical copy.
- The hidden file input stays disabled until upload is configured.
- Programmatic upload attempts still show the same message if they reach the
  controller.

### Profile Edit

- Picture and banner pickers stay disabled when upload is not configured.
- Clicking a disabled picker opens Upload Settings.
- The same hint appears near the disabled controls.

## Upload Settings

Upload Settings remains the only place to configure Blossom or NIP-96 provider
records. Other surfaces must not duplicate provider editing.

## Related

- [../../../protocol/media-upload.md](../../../protocol/media-upload.md).
- [../../../product/tools/upload-settings.md](../../../product/tools/upload-settings.md).
- [../../../product/tools/tweet.md](../../../product/tools/tweet.md).
