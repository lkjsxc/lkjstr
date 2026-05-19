# Product

## Purpose

Product docs define the visible workspace contract. The first screen is the app
itself: split tiles, tabs, relay-backed data, and local state.

## Documents

- [feeds/README.md](feeds/README.md): relay-backed reading surfaces.
- [tools/README.md](tools/README.md): local tools and settings surfaces.
- [workspace/README.md](workspace/README.md): tiles, panes, tabs, and flows.

## Shared Surface Rules

- Every tab fits inside its tile without horizontal pane scrolling.
- Tab bodies own the full available tile height so split panes do not collapse
  feed lists.
- Long URLs, event ids, public keys, relay messages, code, labels, and note
  content wrap inside their visible container.
- Action-opened Profile and Thread tabs inherit the clicked tile context.
