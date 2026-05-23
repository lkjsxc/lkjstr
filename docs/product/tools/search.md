# Search

## Purpose

Search documents the user-facing query surface for cached and relay-backed
matches.

## Contract

- Search opens from New Tab.
- The query field opens empty, even when an active account exists.
- Search never populates the query from the active account.
- Search only runs after the user enters text and submits the form.
- Queries run against cached event content in local storage.
- Queries also send NIP-50 `search` filters to enabled read relays in the
  selected default relay set.
- Remote results are relay-support-dependent; relays that ignore NIP-50 do not
  produce matches.
- Results render through the shared event row surface.
- Search does not require an active signing account.
