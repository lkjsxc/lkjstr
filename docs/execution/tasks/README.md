# Execution Tasks

## Purpose

This subtree breaks the current Rust/WASM execution queue into narrow tasks that
another agent can complete without changing product direction. Each task must be
kept aligned with current-state, the relevant architecture contract, source, and
verification ledgers in the same change.

## Table of Contents

Active queue:

- [cloudflare-wasm-production-repair.md](cloudflare-wasm-production-repair.md): active hosted root and Rust/WASM bridge production repair.
- [feed-001-shared-feed-runtime-gap-closure.md](feed-001-shared-feed-runtime-gap-closure.md): current shared feed blocker after bridge production repair.
- [post-display-reliability.md](post-display-reliability.md): screenshot-class read availability and real-post display repair.
- [storage-001-storage-boundary-audit.md](storage-001-storage-boundary-audit.md): storage boundary audit.
- [publicchat-001-real-public-chat-runtime.md](publicchat-001-real-public-chat-runtime.md): real NIP-28 runtime target.
- [publish-001-rust-publish-jobs.md](publish-001-rust-publish-jobs.md): Rust publish job model.
- [media-001-rust-upload-validation.md](media-001-rust-upload-validation.md): upload validation and auth.
- [sec-001-passkey-capability.md](sec-001-passkey-capability.md): truthful passkey capability states.
- [stats-001-diagnostics-integration.md](stats-001-diagnostics-integration.md): diagnostics integration.
- [search-001-search-deletion-proof.md](search-001-search-deletion-proof.md): blocked Search deletion proof.
- [cut-001-delete-retained-product-paths.md](cut-001-delete-retained-product-paths.md): blocked broad deletion proof.
- [custom-request-provider-wiring.md](custom-request-provider-wiring.md): preserve Custom Request provider wiring evidence.

Repository task evidence:

- [doc-001-enforce-200-line-documentation-cap.md](doc-001-enforce-200-line-documentation-cap.md): closed 200-line cap task.
- [doc-002-split-execution-verification-docs.md](doc-002-split-execution-verification-docs.md): closed execution and verification split.
- [doc-003-current-state-routed-contract.md](doc-003-current-state-routed-contract.md): closed current-state routing.
- [doc-004-readme-recursive-tocs.md](doc-004-readme-recursive-tocs.md): README topology task.
- [check-001-line-limit-constants.md](check-001-line-limit-constants.md): closed checker constants task.
- [check-002-product-fixture-import-guard.md](check-002-product-fixture-import-guard.md): closed fixture guard task.
- [rustwasm-toolchain-001-wasm-pack-boundary.md](rustwasm-toolchain-001-wasm-pack-boundary.md): closed Rust/WASM toolchain boundary task.

Storage evidence to preserve:

- [storage-command-metadata.md](storage-command-metadata.md): expand typed
  storage command coverage with the batch-capable shape.
- [storage-feed-cache-commands.md](storage-feed-cache-commands.md): cover event
  cache, feed cursor, feed coverage, scan hints, and cached feed pages.
- [storage-retention-repair.md](storage-retention-repair.md): wire retention
  delete dispatch and repair reporting.
- [storage-stats-pressure-inventory.md](storage-stats-pressure-inventory.md):
  complete pressure, inventory, and Stats storage diagnostics.
- [storage-search-index.md](storage-search-index.md): add storage-owned search
  and tag lookup rows without advancing Search surface parity.

Implemented evidence:

- [home-feed-slice.md](home-feed-slice.md): preserve first Rust Home feed
  rendering from app-owned view-model rows without parity inflation.
- [profile-feed-slice.md](profile-feed-slice.md): preserve first Rust Profile
  note rendering from app-owned view-model rows without parity inflation.
- [shared-feed-view-model.md](shared-feed-view-model.md): preserve pure Rust
  feed row view-model data, stable ids, explicit state rows, and footer proof.
- [relay-effect-runner.md](relay-effect-runner.md): preserve relay reducer
  effect mapping, typed host event feeding, and owner callback rejection proof.
- [storage-command-spec-shape.md](storage-command-spec-shape.md): preserve the
  batch-capable command metadata shape.
- [storage-active-selector.md](storage-active-selector.md): preserve the closed
  SQLite active-account selector proof while Accounts parity remains partial.
- [home-feed-provider-wiring.md](home-feed-provider-wiring.md): preserve Rust
  Home cache proof and relay snapshot provider wiring.
- [profile-feed-provider-wiring.md](profile-feed-provider-wiring.md): preserve
  Rust Profile cache, header, and relay snapshot provider wiring.
- [profile-sparse-history-proof.md](profile-sparse-history-proof.md): preserve
  Rust Profile sparse historical absence proof.
- [search-feed-provider-wiring.md](search-feed-provider-wiring.md): preserve
  Rust Search provider, local indexed rows, relay snapshot merge, tab snapshot
  restore, and cached plus relay older-page proof.
- [thread-feed-provider-wiring.md](thread-feed-provider-wiring.md): preserve
  Rust Thread cached root/reply provider wiring, bounded bootstrap relay reads,
  explicit older-page relay commands, and scroll-triggered plus viewport-fill
  older requests plus bounded live reply windows, focused-reference hydration,
  bounded cached parent-chain hydration, terminal unavailable-parent rows, and
  continuation rows without parity inflation.
- [followees-provider-wiring.md](followees-provider-wiring.md): preserve the
  first Rust Followees body and default cached host provider from real NIP-02
  follow-list entries without claiming follow-graph deletion readiness.
- [user-timeline-provider-wiring.md](user-timeline-provider-wiring.md): replace
  the Rust User Timeline placeholder with injected and default cached real
  event-row proof plus selected-relay kind `3` discovery.
- [author-context-provider-wiring.md](author-context-provider-wiring.md):
  preserve the first Rust Author Context body from real shared-feed rows
  without claiming cache, relay, or deletion proof.

## Task Rule

A task is not complete until docs, implementation, focused tests, ledger status,
and actual verification evidence are updated. Task files keep the checked
Purpose, Status, Current Evidence, Next Edit, Files To Read, Files To Touch,
Focused Gate, Acceptance, and Must Not headings. Do not claim parity or delete
TypeScript or Svelte product paths from a task marked partial.
