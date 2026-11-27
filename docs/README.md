# Docs

## Purpose

Index of lkjstr's documentation. Start with [status.md](status.md).

## Table of Contents

Frontend (`web/`):

- [design.md](design.md): the look and the interaction rules, as built.
- [time-rail.md](time-rail.md): cache-wide month scale, native fallbacks and verification.
- [absolute-time-window.md](absolute-time-window.md): cached absolute reads and current follow-list provenance.
- [interface-verification.md](interface-verification.md): specified keys/messages, captures and runtime gate evidence.
- [frontend.md](frontend.md): structure of `web/`, the engine boundary, gates.
- [frontend-layout.md](frontend-layout.md): batched overflow measurement and retained-row layout evidence.
- [integration-release.md](integration-release.md): real-engine release candidate and UI gaps.
- [public-deep-links.md](public-deep-links.md) lists public Nostr paths.
- [nostr-operations.md](nostr-operations.md) covers release announcements and relay feedback.
- [hosting-needs.md](hosting-needs.md): what the static host must serve.
- [offline-shell.md](offline-shell.md): verified shell storage, update lifetimes and bounds.
- [public-view-cache.md](public-view-cache.md): public rendering snapshots, privacy authorization and reconciliation.
- [live-feed.md](live-feed.md): arrivals at the top without a press, held reading positions, evidence and release path.
- [repost.md](repost.md): public-source repost comparison.

Engine (`crates/`):

- [media-uploads.md](media-uploads.md): destinations, failure/retry, bounds and proof.
- [client-attribution.md](client-attribution.md) explains note tags, app information and opt-out.
- [channels.md](channels.md): NIP-28 sources, actions, bounds and verification.
- [zaps.md](zaps.md): provider-authorized receipts, unpaid invoice intents, lifetime and bounds.
- [engine-zap-verification.md](engine-zap-verification.md): zap integration gates and runtime regressions.
- [protocol3.md](protocol3.md): rich filters, notifications, profile kinds and gates.
- [search.md](search.md): retained people, note-only windows, language arrays and verification.
- [unavailable-reposts.md](unavailable-reposts.md): note quota, Fresh and owned target hydration evidence.
- [status.md](status.md): what works, what does not, next steps in order.
- [outbox.md](outbox.md): read cursors, durable quality, focus, weights and purposes.
- [cover.md](cover.md): hydration traffic, duplicate resumption, public medians and gaps.
- [engine-q1-progress.md](engine-q1-progress.md): exact sharing, finite page correctness and read-plan evidence.
- [q1-public-score-20261117.md](q1-public-score-20261117.md): Q1 matched real-relay score, witness bounds and validation.
- [engine-q1-localreads.md](engine-q1-localreads.md): bounded optional exact-ID reads before relay fallback.
- [engine-q1-frontier.md](engine-q1-frontier.md): independent logical quotas in shared finite requests.
- [engine-filter-identity.md](engine-filter-identity.md): canonical selector identity and preserved ownership.
- [engine-read-scorecard.md](engine-read-scorecard.md): deterministic device-wide wants and protocol-cost measurements.
- [read-score-baseline.md](read-score-baseline.md): unchanged-product scorecard baseline.
- [read-score.md](read-score.md): read-plan scorecard method and results.
- [orchestration.md](orchestration.md): publication routing, freshness, weights and limits.
- [orchestration-optimizer.md](orchestration-optimizer.md) covers Stage 1 scheduling and retention.
- [fetch-orchestrator.md](fetch-orchestrator.md) covers timeline coverage, weighted scheduling and release steps.
- [signer-orchestrator.md](signer-orchestrator.md) covers extension weights, admission and ownership.
- [thin-link.md](thin-link.md): slow-link scheduling, startup and measured bounds.
- [relay-orchestration-20261119.md](relay-orchestration-20261119.md): progressive reads, cache gaps, NIP-65 and bounded prefetch.
- [architecture.md](architecture.md): crates, runtime, orchestration, storage.
- [cache-retention.md](cache-retention.md): Home parity and weighted metadata checkpoints.
- [durable-cache.md](durable-cache.md): shared durable GDSF epochs, proof recovery and bounds.
- [compact-event-store.md](compact-event-store.md): binary resident payloads, leases and memory qualification.
- [cache-bootstrap.md](cache-bootstrap.md): verified public restore, metadata checkpoints, bounds and proof.
- [cache-repeat.md](cache-repeat.md): repeated public cache reads and measurement.
- [cache-repeat-private.md](cache-repeat-private.md): private cache authorization proof.
- [race-open.md](race-open.md): browser first-screen race evidence.
- [cache-context.md](cache-context.md): durable contributors, held-reference authority, selection policy and bounds.
- [verification.md](verification.md): gates, browser checks and their results.
- [mention-verification.md](mention-verification.md): exact signed mentions and loopback readback.
- [engine-stream-verification.md](engine-stream-verification.md): first stream gate evidence and limits.
- [engine-lifetime-verification.md](engine-lifetime-verification.md): ownership, queue and retained-history follow-up gates.
- [decisions.md](decisions.md): durable decisions and why.
- [engine.md](engine.md): the engine Worker and how it serves the protocol.
- [engine-package.md](engine-package.md): building the Worker assets for `web/`.
- [engine-polish.md](engine-polish.md): author hydration, count estimates and Global sample.
- [hidden-note-visibility.md](hidden-note-visibility.md): timeline selection, covered slots, reveal, and missing-row evidence.
- [engine-startup.md](engine-startup.md): real-build WASM preload regression and scoped correction.
- [engine-shipping.md](engine-shipping.md): exact-source shipping, host validation and schema-compatible rollback.
- [engine-performance.md](engine-performance.md): measurements.
- [engine-performance-open-baseline.md](engine-performance-open-baseline.md): desktop opening baseline.
- [engine-performance-open.md](engine-performance-open.md): opening-race measurement.
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
- [engine-proposals-emoji.md](engine-proposals-emoji.md): private emoji collision fields and provenance.
- [signing-latency.md](signing-latency.md): public signing timings and Worker contention.
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
- [Account availability verification](engine-availability-verification.md): fixed boot failure, retained client state and current evidence.
- [Engine capabilities awaiting interface specifications](interface-needs.md)
- [interface-specs.md](interface-specs.md): surfaces to build, item by item, with their state.
- [interface-relay.md](interface-relay.md): R1, the Relay tab: one relay, its NIP-11 head and the notes it served.
- [interface-keys.md](interface-keys.md): password-protected keys: sign-in, lock, backup, protection.
- [interface-dm.md](interface-dm.md): private messages: list, conversation, writing, inbox relays.
- [interface-acts.md](interface-acts.md): reactions and reposts of reactions and reposts.
- [interface-profile.md](interface-profile.md): editing one's own profile, with picture and banner uploads.
- [interface-emoji.md](interface-emoji.md): the emoji picker, its preview, the popover, preloading, shared codes.
- [interface-view.md](interface-view.md): every kind opens: generic, list and article faces, chains, acts as posts.
- [interface-thread.md](interface-thread.md): the thread tab: focus, compact notes above, replies, reply field.
- [interface-time.md](interface-time.md): travelling by time: the scroll label, the wide scrubber, jumps.
- [interface-moment.md](interface-moment.md): a note's time opens the author's Home at that moment.
- [interface-client.md](interface-client.md): "via <client>" by a note's time, app information, the opt-out.
- [interface-hidden.md](interface-hidden.md): which notes are not shown, why, and how to show them.
- [engine-acts.md](engine-acts.md): bounded act chains, ownership, profile selection and verification.
- [read-plan.md](read-plan.md): one plan for everything the tabs want, with weights made from the past.

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

- [Exact relay filter identity](engine-filter-identity.md): canonical logical read identity.
- [Logical page frontiers](engine-q1-frontier.md): independent quotas inside shared envelopes.
