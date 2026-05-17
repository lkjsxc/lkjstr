# Product Canon

Owner: Product
State: Canon

## Purpose

This directory defines the browser-first Nostr deck client as a product. These docs are canonical for scope, user workflows, and UI behavior.

## Product Shape

The client is a SvelteKit web app for people who read, compose, and monitor Nostr across user-configured relays. The primary screen is a deck: a workspace of tiles that can show timelines, relay health, accounts, searches, composer drafts, and operational status.

The app must work well before any server dependency is introduced. Browser storage, workers, and relay connections are first-class product surfaces, not implementation details hidden from users.

## Documents

- [scope.md](scope.md): product boundaries and non-goals.
- [workflows.md](workflows.md): user workflows that define acceptance.
- [deck.md](deck.md): canonical deck and tile behavior.
- [timeline.md](timeline.md): timeline tile behavior.
- [composer.md](composer.md): note composer and publish UX.
