# Docs

## Purpose

This tree is the implementation contract for lkjstr. Product behavior,
runtime ownership, relay policy, and verification expectations are documented
here before code is changed.

## Documents

- [current-state.md](current-state.md): implemented app state.
- [architecture/README.md](architecture/README.md): source ownership.
- [decisions/README.md](decisions/README.md): durable project decisions.
- [operations/README.md](operations/README.md): verification and safety.
- [product/README.md](product/README.md): user-facing workspace contract.
- [protocol/README.md](protocol/README.md): Nostr contracts.
- [repository/README.md](repository/README.md): layout and workflow rules.
- [research/README.md](research/README.md): background notes.
- [vision/README.md](vision/README.md): long-term scope.

## Active Contracts

- Event rows show display names, dates, and short event ids; full public keys
  and relay URLs stay in identity, relay, and diagnostic surfaces.
- Home, Global, and Notifications use shared storage and relay subscriptions.
- Partial relay failure must not keep a feed in a loading state.
- Workspace tabs support native drag-and-drop movement across tiles.
