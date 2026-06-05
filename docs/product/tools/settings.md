# Settings

## Purpose

Settings provide editable local preferences as one flat key-value list.

## Contract

- Settings opens from New Tab.
- Flat setting overrides are persisted through the SQLite worker when browser
  Workers are available, with in-memory fallback for unavailable storage.
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
  `void-cat`, or `custom` today. The next provider id is `blossom`.
- `tweet.mediaUploadCustomServer` stores an optional HTTPS upload server origin
  or endpoint for custom NIP-96 and Blossom providers. Blank disables custom
  upload.
- Invalid custom upload server values stay inline and are not saved.
- `tweet.mediaUploadNoTransform` requests no server-side media transformation
  when uploads are sent.
- Notification unread tab badge settings are retired and must not be loaded,
  displayed, or used.
- `notifications.enabled` and `notifications.defaultCategories` remain inert
  flat settings. They do not gate notification capture, indexing, unread state,
  or rendering.
- Stats auto-refresh is controlled by a checkbox in Stats, not by a text-like
  button.
- JSON import uses an inline textarea and status. Browser prompt dialogs are
  not used.
- Retired draft-tree settings are not part of the schema.
- `tabs.inactiveRetentionSeconds` controls how long inactive tab UI snapshots
  are retained in session memory after focus changes.
- It does not keep inactive tab DOM, runtimes, subscriptions, or relay reads
  mounted.
- `tabs.inactiveRetentionSeconds` defaults to `300`, is an integer, and accepts
  values from `0` to `3600` seconds.
- A value of `0` disables inactive tab retention.
- `cache.maxBytes` defaults to `67108864` bytes, is stored as integer bytes,
  and accepts values from `1048576` to `10737418240` bytes.
- `cache.maxBytes` is the site storage target when browser estimates are
  available. Protected records are reported as protected pressure instead of
  being deleted.
- The flat Settings row may show practical byte help such as MiB or GiB and
  may step by MiB-sized increments. It must still save the raw byte number.
- Setting `cache.maxBytes` to `1073741824` bytes is a supported heavy-user
  one GiB budget.
- Saving, importing, resetting, or namespace-resetting to a smaller effective
  `cache.maxBytes` value triggers immediate site budget enforcement instead of
  waiting for routine write-count scheduling.
- Cache compaction keys `cache.maxEvents`, `cache.maxAgeDays`, and
  `cache.compactionEnabled` are retired. Local-cache retention is automatic. See
  [cache.md](cache.md) and
  [storage retention](../../architecture/data/storage/retention/README.md).

## Rust Conversion Status

- The Rust/WASM shell renders the flat settings schema and stored overrides
  from Rust.
- Rust Settings side effects such as CSS appearance updates and cache budget
  enforcement remain incomplete until the Rust UI owns the full surface.
