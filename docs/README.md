# Docs

## Purpose

Index of lkjstr's documentation. Start with [status.md](status.md).

## Table of Contents

Frontend (`web/`):

- [design.md](design.md): the look and the interaction rules, as built.
- [time-rail.md](time-rail.md): cache-wide month scale, native fallbacks and verification.
- [interface-verification.md](interface-verification.md): specified keys/messages, captures and runtime gate evidence.
- [frontend.md](frontend.md): structure of `web/`, the engine boundary, gates.
- [frontend-layout.md](frontend-layout.md): batched overflow measurement and retained-row layout evidence.
- [integration-release.md](integration-release.md): real-engine release candidate and UI gaps.
- [hosting-needs.md](hosting-needs.md): what the static host must serve.
- [offline-shell.md](offline-shell.md): verified shell storage, update lifetimes and bounds.
- [repost.md](repost.md): public-source repost comparison.

Engine (`crates/`):

- [media-uploads.md](media-uploads.md): destinations, failure/retry, bounds and proof.
- [channels.md](channels.md): NIP-28 sources, actions, bounds and verification.
- [zaps.md](zaps.md): provider-authorized receipts, unpaid invoice intents, lifetime and bounds.
- [engine-zap-verification.md](engine-zap-verification.md): zap integration gates and runtime regressions.
- [protocol3.md](protocol3.md): rich filters, notifications, profile kinds and gates.
- [search.md](search.md): retained people, note-only windows, language arrays and verification.
- [unavailable-reposts.md](unavailable-reposts.md): note quota, Fresh and owned target hydration evidence.
- [status.md](status.md): what works, what does not, next steps in order.
- [outbox.md](outbox.md): read cursors, durable quality, focus, weights and purposes.
- [cover.md](cover.md): hydration traffic, duplicate resumption, public medians and gaps.
- [orchestration.md](orchestration.md): publication routing, freshness, weights and limits.
- [architecture.md](architecture.md): crates, runtime, orchestration, storage.
- [verification.md](verification.md): gates, browser checks and their results.
- [engine-stream-verification.md](engine-stream-verification.md): first stream gate evidence and limits.
- [engine-lifetime-verification.md](engine-lifetime-verification.md): ownership, queue and retained-history follow-up gates.
- [decisions.md](decisions.md): durable decisions and why.
- [engine.md](engine.md): the engine Worker and how it serves the protocol.
- [engine-package.md](engine-package.md): building the Worker assets for `web/`.
- [engine-polish.md](engine-polish.md): author hydration, count estimates and Global sample.
- [engine-startup.md](engine-startup.md): real-build WASM preload regression and scoped correction.
- [engine-shipping.md](engine-shipping.md): exact-source shipping, host validation and schema-compatible rollback.
- [engine-performance.md](engine-performance.md): measurements.
- [engine-performance-ninth.md](engine-performance-ninth.md): ninth hour, resources, faults and measurement limits.
- [engine-performance-ninth-coverage.md](engine-performance-ninth-coverage.md): hidden quote rows, receipt budgets and repeated acquisition.
- [engine-performance-zaps.md](engine-performance-zaps.md): bounded receipt projection and scheduling proofs.
- [engine-performance-public.md](engine-performance-public.md): public controls, attribution and limits.
- [engine-performance-third.md](engine-performance-third.md): shipped third-landing hour and faults.
- [engine-performance-sixth.md](engine-performance-sixth.md): sixth candidate hour, memory and complete fault phases.
- [engine-performance-sixth-coverage.md](engine-performance-sixth-coverage.md): exact receipts, route transitions and seven unresolved Home candidates.
- [engine-performance-evidence.md](engine-performance-evidence.md): bounded host delivery evidence and its limits.
- [engine-performance-hour.md](engine-performance-hour.md): corrected hour, memory and coverage gaps.
- [engine-verification-pressure.md](engine-verification-pressure.md): bounded acquisition and dropped-page replay.
- [engine-retained-diff.md](engine-retained-diff.md): retained-window diff cost and bounded key lookup.
- [engine-thread-order.md](engine-thread-order.md): relationship order across timestamp ties and clock skew.
- [engine-proposals.md](engine-proposals.md): protocol proposals and their outcome.
- [engine-proposals-history.md](engine-proposals-history.md): preserved earlier protocol additions.
- [storage-inspection.md](storage-inspection.md): finite storage observations, bounds and verification limits.
- [engine-device-verification.md](engine-device-verification.md): protocol-12 merged gates, production and historical proof.
- [storage-next.md](storage-next.md): separate cache-clear and settings-archive proposals.
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
- [Encrypted private drafts and failed sends](dm-drafts.md)
- [Private editor coordination before locking](dm-editor-locks.md)
- [Private signer lifetime and failure bounds](dm-signers.md)
- [Private list query ownership and hydration](private-list-scope.md)
- [Specified private-message interface wiring](frontend-dm.md)
- [Encrypted local keys and session access](keys.md)
- [Account snapshot persistence and schema fence](account-persistence.md)
- [Account production verification](engine-account-verification.md): maintained command, source binding and fixture corrections.
- [Engine capabilities awaiting interface specifications](interface-needs.md)
- [interface-specs.md](interface-specs.md): surfaces to build, item by item, with their state.
- [interface-keys.md](interface-keys.md): password-protected keys: sign-in, lock, backup, protection.
- [interface-dm.md](interface-dm.md): private messages: list, conversation, writing, inbox relays.
- [interface-acts.md](interface-acts.md): reactions and reposts of reactions and reposts.
- [interface-moment.md](interface-moment.md): one event drawn at one moment in every tab.

- [relay-auth.md](relay-auth.md): scoped relay authentication and async identity races.
- [bunker-auth.md](bunker-auth.md): private signer authorization intents, ownership and original deadlines.

- [private-lists.md](private-lists.md): account-scoped private reads, cached mute policy and signer lifetimes.
- [engine-private-verification.md](engine-private-verification.md): protocol-10 private integration gates, proofs and artifact boundaries.
- [engine-variants-verification.md](engine-variants-verification.md): protocol-11 combined gates, retained-repost proof and production artifacts.

- [engine-performance-dom.md](engine-performance-dom.md): bounded source DOM membership, wire/cutoff separation and evidence limits.

- [engine-history-route.md](engine-history-route.md): inclusive history route continuity and bounded verification evidence.
- [emoji-sets.md](emoji-sets.md): bounded owner-selected emoji discovery, native
  evidence and real Worker verification.
- [engine-live-route.md](engine-live-route.md): productive live recovery, bounded slot ownership and verification evidence.

- [Historical measurement witnesses](engine-performance-history.md): bounded selection; ninth public DOM positives and receipt limits are recorded separately.
