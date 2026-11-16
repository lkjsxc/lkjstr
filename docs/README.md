# Docs

## Purpose

Index of lkjstr's documentation. Start with [status.md](status.md).

## Table of Contents

Frontend (`web/`):

- [design.md](design.md): the look and the interaction rules, as built.
- [time-rail.md](time-rail.md): cache-wide month scale, native fallbacks and verification.
- [frontend.md](frontend.md): structure of `web/`, the engine boundary, gates.
- [integration-release.md](integration-release.md): real-engine release candidate and UI gaps.
- [hosting-needs.md](hosting-needs.md): what the static host must serve.
- [offline-shell.md](offline-shell.md): verified shell storage, update lifetimes and bounds.
- [repost.md](repost.md): public-source repost comparison.

Engine (`crates/`):

- [media-uploads.md](media-uploads.md): destinations, failure/retry, bounds and proof.
- [channels.md](channels.md): NIP-28 sources, actions, bounds and verification.
- [protocol3.md](protocol3.md): rich filters, notifications, profile kinds and gates.
- [status.md](status.md): what works, what does not, next steps in order.
- [outbox.md](outbox.md): read cursors, durable quality, focus, weights and purposes.
- [cover.md](cover.md): hydration traffic, duplicate resumption, public medians and gaps.
- [orchestration.md](orchestration.md): publication routing, freshness, weights and limits.
- [architecture.md](architecture.md): crates, runtime, orchestration, storage.
- [verification.md](verification.md): gates, browser checks and their results.
- [engine-stream-verification.md](engine-stream-verification.md): current stream gate evidence and limits.
- [decisions.md](decisions.md): durable decisions and why.
- [engine.md](engine.md): the engine Worker and how it serves the protocol.
- [engine-package.md](engine-package.md): building the Worker assets for `web/`.
- [engine-polish.md](engine-polish.md): author hydration, count estimates and Global sample.
- [engine-performance.md](engine-performance.md): measurements.
- [engine-performance-public.md](engine-performance-public.md): public controls, attribution and limits.
- [engine-proposals.md](engine-proposals.md): protocol proposals and their outcome.
- [parity.md](parity.md): audited client capability inventory.
- [details.md](details.md): observed frictions and fixes.
- [workspace.md](workspace.md): historical workspace design; superseded by
  design.md for `web/`.
- [design-review.md](design-review.md): review of the previous design text;
  historical.

- [Owner engine feedback](owner-feedback.md): relay discovery, tags, media, stats and continuity.

- [wishes.md](wishes.md): owner wishes, protocol 5 and verification boundaries.
- [owner-audit.md](owner-audit.md): returning profiles and owner complaint verification.
- [Private-message engine and limits](dm.md)
- [Encrypted local keys and session access](keys.md)
- [Engine capabilities awaiting interface specifications](interface-needs.md)
- [interface-specs.md](interface-specs.md): surfaces to build, item by item, with their state.
- [interface-keys.md](interface-keys.md): password-protected keys: sign-in, lock, backup, protection.
- [interface-dm.md](interface-dm.md): private messages: list, conversation, writing, inbox relays.

- [relay-auth.md](relay-auth.md): scoped relay authentication and async identity races.
