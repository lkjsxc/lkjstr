# Docs

## Purpose

Index of lkjstr's documentation. Start with [status.md](status.md).

## Table of Contents

Frontend (`web/`):

- [design.md](design.md): the look and the interaction rules, as built.
- [frontend.md](frontend.md): structure of `web/`, the engine boundary, gates.
- [integration-release.md](integration-release.md): real-engine release candidate and UI gaps.
- [hosting-needs.md](hosting-needs.md): what the static host must serve.
- [repost.md](repost.md): public-source repost comparison.

Engine (`crates/`):

- [channels.md](channels.md): NIP-28 sources, actions, bounds and verification.
- [protocol3.md](protocol3.md): rich filters, notifications, profile kinds and gates.
- [status.md](status.md): what works, what does not, next steps in order.
- [architecture.md](architecture.md): crates, runtime, orchestration, storage.
- [verification.md](verification.md): gates, browser checks and their results.
- [decisions.md](decisions.md): durable decisions and why.
- [engine.md](engine.md): the engine Worker and how it serves the protocol.
- [engine-package.md](engine-package.md): building the Worker assets for `web/`.
- [engine-polish.md](engine-polish.md): author hydration, count estimates and Global sample.
- [engine-performance.md](engine-performance.md): measurements.
- [engine-proposals.md](engine-proposals.md): protocol proposals and their outcome.
- [parity.md](parity.md): audited client capability inventory.
- [details.md](details.md): observed frictions and fixes.
- [workspace.md](workspace.md): historical workspace design; superseded by
  design.md for `web/`.
- [design-review.md](design-review.md): review of the previous design text;
  historical.

- [Owner engine feedback](owner-feedback.md): relay discovery, tags, media, stats and continuity.
