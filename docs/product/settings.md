Owner: Product
State: Canon

# Settings

## Purpose

Settings are edited through a searchable, categorized key-value settings tab.

## Settings Tab Contract

- The settings tab opens from the left sidebar.
- Search is always visible at the top.
- A category rail filters by namespace.
- Narrow tiles collapse categories into a dropdown.
- The main panel shows grouped key-value rows.
- Selecting a row opens an inspector with key, description, type, default,
  current value, JSON preview, reset, and copy actions.
- Settings are grouped by namespace and searched by namespace, key, label,
  description, type, default value, and current value.
- Values edit inline and validate before saving.
- Boolean values use switches.
- Enum values use select controls.
- Number values use numeric inputs.
- String values use text inputs.
- JSON values use compact textareas.
- Invalid edits fail safely and keep the previous value.
- Each key can reset to its default.
- Each namespace can reset all keys it owns.
- Sensitive values are masked by default.
- Changed values are marked.
- JSON export and import use validation.
- Normal setting edits do not reload the page.

## Required Namespaces

`appearance`, `workspace`, `tiles`, `tabs`, `relays`, `accounts`,
`notifications`, `timeline`, `composer`, `cache`, `security`, `settings`, and
`debug`.

## Required Keys

`workspace.route`, `workspace.autoRecoverZeroPanels`,
`workspace.closeTileWhenLastTabCloses`, `workspace.sidebarVisible`,
`tiles.defaultSplitDirection`, `tiles.smartSplitSameDirection`,
`tiles.closeRemovesSubscriptions`, `tiles.menuActions`, `tabs.openSource`,
`tabs.closeLastTabBehavior`, `timeline.defaultKind`,
`timeline.initialLimit`, `timeline.useDefaultRelays`, `timeline.cacheFirst`,
`timeline.showRelayProvenance`, `relays.defaultSet`,
`relays.seedOnFirstBoot`, `relays.connectTimeoutMs`,
`relays.reconnectBackoffMs`, `appearance.theme`,
`appearance.neutralPalette`, `appearance.cornerRadius`,
`appearance.showAvatars`, `settings.searchMode`,
`settings.showInspector`, and `settings.compactNarrowLayout`.

## Acceptance

- Searching for `relays`, `timeline`, split behavior, or `workspace.route`
  narrows rows.
- Editing theme and radius keys changes the UI.
- The inspector updates when a row is selected.
- Settings persist after reload and work with zero accounts.
