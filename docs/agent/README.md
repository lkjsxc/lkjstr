# Agent Manual

## Purpose

This subtree is the operating manual for autonomous coding agents working on
lkjstr. `AGENTS.md` routes here. The manual owns the change loop, the product
truth rule, the handoff contract, and the repository skills. Product,
protocol, architecture, operations, and execution contracts stay canonical in
their own subtrees; this manual links to them instead of restating them.

## Table of Contents

- [work-loop.md](work-loop.md): the change loop from orientation to handoff.
- [no-fake-data.md](no-fake-data.md): the canonical product truth rule.
- [handoff.md](handoff.md): commit and final-report evidence format.
- [skills/README.md](skills/README.md): skill format contract and index.
- [skills/doc-contract-edit.md](skills/doc-contract-edit.md): docs-only
  contract changes.
- [skills/rust-wasm-slice.md](skills/rust-wasm-slice.md): shared Rust/WASM
  cutover slice procedure.
- [skills/storage-kernel.md](skills/storage-kernel.md): SQLite worker storage
  work.
- [skills/relay-runtime.md](skills/relay-runtime.md): relay scheduler and
  effect work.
- [skills/feed-runtime.md](skills/feed-runtime.md): shared feed runtime and
  Home slice work.
- [skills/ui-surface.md](skills/ui-surface.md): Svelte and Leptos surface
  work.
- [skills/deletion-proof.md](skills/deletion-proof.md): deleting replaced
  TypeScript or Svelte modules.
- [skills/security-local-keys.md](skills/security-local-keys.md): signing
  accounts and local secrets.
- [skills/agent-maintenance.md](skills/agent-maintenance.md): maintaining
  `AGENTS.md`, this manual, and the skills.
- [skills/search-runtime.md](skills/search-runtime.md): Search runtime work.
- [skills/custom-request-runtime.md](skills/custom-request-runtime.md): Custom Request runtime work.
- [skills/public-chat-runtime.md](skills/public-chat-runtime.md): Public Chat runtime work.
- [skills/publish-runtime.md](skills/publish-runtime.md): publish job work.
- [skills/media-upload.md](skills/media-upload.md): media upload work.
- [skills/stats-diagnostics.md](skills/stats-diagnostics.md): Stats and Log diagnostics.

## Authority

- This manual owns agent workflow, handoff format, and skill routing.
- [no-fake-data.md](no-fake-data.md) owns the product truth rule. Other docs
  link to it instead of restating the full list.
- Execution status and the task queue stay in
  [../execution/README.md](../execution/README.md) and
  [../execution/current-blockers.md](../execution/current-blockers.md).
- Verification commands stay canonical in
  [../operations/verification.md](../operations/verification.md) and
  [../operations/focused-gates.md](../operations/focused-gates.md).
- Durable product and architecture decisions stay in
  [../decisions/README.md](../decisions/README.md).
