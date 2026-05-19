# Settings

## Purpose

Settings provide editable local preferences as one flat key-value list.

## Contract

- Settings opens from New Tab.
- Every record shows label, key, description, editor, type, and changed state.
- There are no category columns, inspectors, search panes, or sectioned lists.
- Keys use namespaces only for persistence and scanning.
- Tweet settings use the `tweet.*` namespace.
- Retired draft-tree settings are not part of the schema.
- `tabs.inactiveRetentionSeconds` controls how long inactive tab components and
  their runtimes are retained after tab focus changes.
- `tabs.inactiveRetentionSeconds` defaults to `300`, is an integer, and accepts
  values from `0` to `3600` seconds.
- A value of `0` disables inactive tab retention.
