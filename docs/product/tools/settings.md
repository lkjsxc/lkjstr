# Settings

## Purpose

Settings provide editable local preferences as one flat key-value list.

## Contract

- Settings opens from New Tab.
- Every record shows label, key, description, editor, type, and changed state.
- There are no category columns, inspectors, search panes, or sectioned lists.
- Keys use namespaces only for persistence and scanning.
- String settings edit raw strings. JSON settings use formatted JSON text.
- Enum upload provider controls show friendly labels while storing ids.
- Tweet settings use the `tweet.*` namespace.
- `content.hideSensitiveEvents` defaults to true and controls whether NIP-36
  events render behind a local reveal gate.
- Guided Tweet media upload editing lives in Upload Settings; Settings remains
  the raw flat key-value editor.
- `tweet.mediaUploadProvider` selects `disabled`, `nostr-build`, `nostrcheck`,
  `void-cat`, or `custom`.
- `tweet.mediaUploadCustomServer` stores an optional HTTPS NIP-96 server origin
  or endpoint for the `custom` provider. Blank disables custom upload.
- Invalid custom upload server values stay inline and are not saved.
- `tweet.mediaUploadNoTransform` requests no server-side media transformation
  when uploads are sent.
- Notification unread tab badge settings are retired and must not be loaded,
  displayed, or used.
- Stats auto-refresh is controlled by a checkbox in Stats, not by a text-like
  button.
- JSON import uses an inline textarea and status. Browser prompt dialogs are
  not used.
- Retired draft-tree settings are not part of the schema.
- `tabs.inactiveRetentionSeconds` controls how long inactive tab components and
  their runtimes are retained after tab focus changes.
- `tabs.inactiveRetentionSeconds` defaults to `300`, is an integer, and accepts
  values from `0` to `3600` seconds.
- A value of `0` disables inactive tab retention.
