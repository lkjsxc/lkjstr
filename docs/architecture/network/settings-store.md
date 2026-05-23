# Settings Store

## Purpose

Settings store owns flat schema records and user overrides.

## Contract

- Schema records include key, namespace, label, description, type, default, and
  current value.
- Settings UI renders one flat list ordered by schema.
- Overrides store only user-provided values.
- Import ignores unknown keys and invalid values.
- Tweet settings use `tweet.*`.
- `notifications.enabled` and `notifications.defaultCategories` are inert
  schema records. Notification capture, indexing, unread state, and rendering
  do not read them.
