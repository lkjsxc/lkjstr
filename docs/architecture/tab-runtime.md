# Tab Runtime

## Purpose

Tab runtime defines valid tab kinds and lifecycle ownership.

## Kinds

`new-tab`, `timeline`, `notifications`, `profile`, `account-manager`,
`thread`, `relay-monitor`, `relay-settings`, `tweet`, `settings`,
`cache-status`.

## Contract

- New Tab can convert only to direct New Tab choices.
- Profile and Thread remain valid tab kinds but open from timeline actions.
- Conversion preserves tab id and tab group.
- Closing a tab must close any runtime subscription owned by that tab.
- Persisted tabs are normalized by the current tab contracts.
