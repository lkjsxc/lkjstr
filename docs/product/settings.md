Owner: Product
State: Canon

# Settings

## Purpose

Settings are edited through a stable grouped key-value settings tab.

## Settings Tab Contract

- The settings tab opens from the New Tab chooser or existing workspace links.
- The tab has no search input, namespace filter, category rail, or filtered
  visible subset.
- The main panel shows grouped key-value sections in stable order.
- Every row shows key, label, description, editor, changed state, and reset.
- Values edit inline and validate before saving.
- Boolean values use switches.
- Enum values use select controls.
- Number values use numeric inputs.
- String values use text inputs.
- JSON values use compact textareas.
- Invalid edits fail safely and keep the previous value.
- Each key can reset to its default.
- Sensitive values are masked by default.
- Changed values are marked.
- JSON export and import use validation.
- Normal setting edits do not reload the page.

## Required Namespaces

`appearance`, `workspace`, `tabs`, `timeline`, `relays`, `profiles`, `posts`,
`accounts`, `notifications`, `composer`, `cache`, `security`, and `debug`.

## Required Keys

`appearance.theme`, `appearance.cornerRadius`, `appearance.showAvatars`,
`workspace.recoverLastTile`, `workspace.defaultTabKind`,
`tabs.closeLastTabClosesTile`, `tabs.newTabChooserEnabled`,
`timeline.initialLimit`, `timeline.defaultRelays`,
`timeline.showRelayProvenance`, `relays.defaultSet`,
`relays.connectTimeoutMs`, `profiles.fetchMetadata`, `profiles.showNip05`,
`posts.persistDrafts`, `posts.showTree`, and `security.allowLocalNsecImport`.

## Acceptance

- Settings has no search or filter controls.
- Appearance, workspace, tabs, timeline, relays, profiles, posts, and security
  groups render in stable order.
- Editing theme and radius keys changes the UI.
- Settings persist after reload and work with zero accounts.
