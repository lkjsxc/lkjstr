# Product Canon

Owner: Product
State: Canon

## Purpose

This directory defines the browser-first Nostr workspace client as a product. These docs are canonical for scope, user workflows, and UI behavior.

## Product Shape

The client is a SvelteKit web app for people who read, compose, and monitor Nostr across user-configured relays. The primary screen is an editor-style workspace: split panes can show timelines, relay health, accounts, searches, composer drafts, raw events, and operational status.

The app must work well before any server dependency is introduced. Browser storage, workers, and relay connections are first-class product surfaces, not implementation details hidden from users.

## Documents

- [scope.md](scope.md): product boundaries and non-goals.
- [workflows.md](workflows.md): user workflows that define acceptance.
- [workspace.md](workspace.md): canonical split-pane workspace behavior.
- [timeline.md](timeline.md): timeline pane behavior.
- [composer.md](composer.md): note composer and publish UX.
