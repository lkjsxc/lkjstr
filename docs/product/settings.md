Owner: Product
State: Canon

# Settings

## Purpose

Settings are edited through a searchable key-value settings tab.

## Settings Tab Contract

- The settings tab opens from the activity bar, empty workspace, and empty pane.
- Settings are grouped by namespace and searched by namespace, key, label,
  description, type, default value, and current value.
- The table shows key, value, default, type, and description.
- Values edit inline and validate before saving.
- Invalid edits fail safely and keep the previous value.
- Each key can reset to its default.
- Each namespace can reset all keys it owns.
- Sensitive values are masked by default.
- JSON export and import use validation.
- Normal setting edits do not reload the page.

## Required Namespaces

`appearance`, `workspace`, `panes`, `tabs`, `relays`, `accounts`,
`notifications`, `composer`, `cache`, `security`, and `debug`.

## Acceptance

- Searching for `radius`, `relays`, or `workspace.route` narrows rows.
- Editing theme and radius keys changes the UI.
- Settings persist after reload and work with zero accounts.
