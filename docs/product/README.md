# Product Canon

Owner: Product
State: Canon

## Purpose

This directory defines the browser-first Nostr workspace client as a product. These docs are canonical for scope, user workflows, and UI behavior.

## Product Shape

The client is a SvelteKit web app for people who read, compose, and monitor
Nostr across editable relay sets. The primary screen is the root `/`
workspace: split panes can show timelines, relay health, accounts, searches,
composer drafts, settings, raw events, and operational status.

The app must work well before any server dependency is introduced. Browser storage, workers, and relay connections are first-class product surfaces, not implementation details hidden from users.

## Documents

- [scope.md](scope.md): product boundaries and non-goals.
- [workflows.md](workflows.md): user workflows that define acceptance.
- [workspace.md](workspace.md): canonical split-pane workspace behavior.
- [panes.md](panes.md): pane and empty pane behavior.
- [tabs.md](tabs.md): tab group, tab, and zero-tab behavior.
- [settings.md](settings.md): searchable key-value settings tab.
- [relay-management.md](relay-management.md): relay set editing and default seeding.
- [timeline.md](timeline.md): timeline pane behavior.
- [composer.md](composer.md): note composer and publish UX.
