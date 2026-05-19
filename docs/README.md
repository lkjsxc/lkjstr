# Docs

## Purpose

This tree is the implementation contract for lkjstr. Product behavior,
runtime ownership, relay policy, and verification expectations are documented
here before code is changed.

## Tree

```text
docs/
|-- architecture/
|   |-- README.md
|   |-- event-tree.md
|   |-- identity-rendering.md
|   |-- job-manager.md
|   |-- profile-runtime.md
|   |-- query-runtime.md
|   |-- relay-pool.md
|   |-- resize.md
|   |-- settings-store.md
|   |-- shared-storage.md
|   |-- storage-workers.md
|   |-- subscription-manager.md
|   |-- system.md
|   |-- tab-runtime.md
|   |-- theme.md
|   |-- thread-runtime.md
|   |-- tile-menu.md
|   |-- timeline-runtime.md
|   |-- tweet-runtime.md
|   |-- ui-composition.md
|   `-- workspace-layout-tree.md
|-- decisions/
|   |-- README.md
|   |-- browser-first.md
|   |-- protocol-kernel.md
|   `-- relay-ownership.md
|-- operations/
|   |-- README.md
|   |-- data-safety.md
|   |-- diagnostics.md
|   |-- docker.md
|   |-- ci.md
|   |-- readiness.md
|   |-- testing-ownership.md
|   `-- verification.md
|-- product/
|   |-- README.md
|   |-- accounts.md
|   |-- cache.md
|   |-- global.md
|   |-- notifications.md
|   |-- panes.md
|   |-- profiles.md
|   |-- relay-management.md
|   |-- scope.md
|   |-- settings.md
|   |-- tabs.md
|   |-- threads.md
|   |-- timeline.md
|   |-- tweet.md
|   |-- workflows.md
|   `-- workspace.md
|-- protocol/
|   |-- README.md
|   |-- default-relays.md
|   |-- events.md
|   |-- kernel.md
|   |-- nip-support.md
|   `-- relays.md
|-- repository/
|   |-- README.md
|   |-- documentation-standards.md
|   |-- layout.md
|   `-- workflow.md
|-- research/
|   |-- README.md
|   |-- browser-storage.md
|   |-- nostr-client-surfaces.md
|   `-- open-questions.md
|-- vision/
|   |-- README.md
|   |-- north-star.md
|   |-- principles.md
|   `-- scope.md
`-- current-state.md
```

## Documents

- [current-state.md](current-state.md): implemented app state.
- [product/README.md](product/README.md): user-facing workspace contract.
- [architecture/README.md](architecture/README.md): source ownership.
- [protocol/README.md](protocol/README.md): Nostr contracts.
- [operations/README.md](operations/README.md): verification and safety.
- [operations/ci.md](operations/ci.md): hosted gates and GHCR publishing.
- [repository/README.md](repository/README.md): layout and workflow rules.
- [decisions/README.md](decisions/README.md): durable project decisions.
- [research/README.md](research/README.md): background notes.
- [vision/README.md](vision/README.md): long-term scope.

## Active Contracts

- Event rows show display names, dates, and short event ids; full public keys
  and relay URLs stay in identity, relay, and diagnostic surfaces.
- Home, Global, and Notifications use shared storage and relay subscriptions.
- Partial relay failure must not keep a feed in a loading state.
- Workspace tabs support native drag-and-drop movement across tiles.
