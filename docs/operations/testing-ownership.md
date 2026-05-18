# Testing Ownership

## Purpose

Testing ownership maps behavior to the right test layer.

## Unit

- Workspace commands and resize math.
- Tab registry and New Tab option list.
- Settings schema and override store.
- Relay set selection and disabled-relay exclusion.
- Follow-list parsing, dedupe, and self inclusion.
- Timeline no-active-account, loading-follows, no-follow-list,
  no-enabled-relay, auth-required, subscription-closed, relay-failed,
  ready-empty, ready-with-events, EOSE, and cleanup behavior.
- Relay diagnostics for `CLOSED`, `NOTICE`, `AUTH`, parse failure, and invalid
  signatures.
- Tweet draft and publish helpers.
- Thread cache and runtime behavior.

## E2E

- Root workspace render.
- New Tab direct choices.
- Flat Settings tab.
- Tweet tab label and prerequisites.
- Relay settings affecting active Account home behavior.
- Synthetic relay diagnostics and cache-only Timeline notes.
- Tile resize persistence.
