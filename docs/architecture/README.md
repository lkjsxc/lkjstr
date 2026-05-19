# Architecture

## Purpose

Architecture docs assign source ownership for app behavior. They define where
state lives, which modules own subscriptions, and how tabs close cleanly.

## Documents

- [data/README.md](data/README.md): repository, cache, and event tree model.
- [network/README.md](network/README.md): relay, identity, jobs, and settings.
- [runtimes/README.md](runtimes/README.md): tab runtime data loading.
- [workspace/README.md](workspace/README.md): layout, tabs, and visual shell.

## Shared Contract

- Browser runtimes normalize optional persisted fields before UI use.
- Relay diagnostics are session state and are rendered independently from feed
  rows.
- Clean-browser Playwright output is authoritative for app-origin browser
  diagnostics.
