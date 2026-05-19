# Event Tree

## Purpose

Event tree defines how feed-like tabs render notes and replies with one shared
model.

## Contract

- Feed pages are converted into roots and child branches before rendering.
- Roots sort newest first.
- Child branches sort newest first.
- A reply whose parent is missing is shown as a root until the parent arrives.
- The UI renders the flattened tree through the shared event tree list.
- Home, Global, Profile, Thread, and Notifications use the same event row
  surface.
- Post rows hide relay source text and full public-key text.
- Rows render avatar, display name, secondary identity fallback, timestamp,
  short event id, and wrapped content.
- Long labels, ids, URLs, code, and note content wrap inside the row.
