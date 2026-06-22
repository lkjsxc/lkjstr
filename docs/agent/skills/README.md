# Skills

## Purpose

Skills are short, executable runbooks for recurring lkjstr work. Each skill
routes an agent to the right contracts, paths, gates, and must-not rules for
one kind of change. Skills compress routing, not contracts: the linked docs
stay canonical.

## Table of Contents

- [doc-contract-edit.md](doc-contract-edit.md): change docs without touching
  source.
- [rust-wasm-slice.md](rust-wasm-slice.md): move product meaning into Rust.
- [storage-kernel.md](storage-kernel.md): SQLite worker storage kernel work.
- [relay-runtime.md](relay-runtime.md): relay schedulers, budgets, and
  diagnostics.
- [feed-runtime.md](feed-runtime.md): shared feed runtime, coverage, and the
  Home slice.
- [ui-surface.md](ui-surface.md): shipped Svelte and target Leptos surfaces.
- [deletion-proof.md](deletion-proof.md): delete replaced TypeScript or
  Svelte modules.
- [security-local-keys.md](security-local-keys.md): accounts, signers, and
  local secrets.
- [agent-maintenance.md](agent-maintenance.md): maintain `AGENTS.md`, the
  agent manual, and skills.
- [search-runtime.md](search-runtime.md): Search local index, NIP-50, and deletion proof.
- [custom-request-runtime.md](custom-request-runtime.md): Custom Request parsing, relay output, and deletion proof.
- [public-chat-runtime.md](public-chat-runtime.md): Public Chat NIP-28 runtime work.
- [publish-runtime.md](publish-runtime.md): Tweet, Profile Edit, and event action publish jobs.
- [media-upload.md](media-upload.md): Blossom, NIP-96, NIP-98, and upload truth.
- [stats-diagnostics.md](stats-diagnostics.md): Stats and lkjstr Log diagnostics.

## Skill Format

Every skill file keeps exactly these checked headings, in this order:

1. `Purpose`: what the skill accomplishes.
2. `Trigger`: when an agent should load it.
3. `Read First`: exact files to read before editing.
4. `Files Likely Touched`: real repository paths.
5. `Procedure`: short executable steps.
6. `Focused Gate`: exact commands that prove the slice.
7. `Final Gate`: when the Docker final gate is required.
8. `Must Not`: hard constraints.
9. `Handoff`: what the slice handoff must include beyond
   [../handoff.md](../handoff.md).

`pnpm check:repo` and `cargo run -p lkjstr-xtask -- check-docs` enforce this
shape for every file in this directory except this README.

## Skill Rules

- Every skill maps to recurring real work. Placeholder skills are forbidden.
- Skills name real paths and real commands from the current tree.
- Skills link to canonical contracts instead of restating them.
- Keep each skill at or below 120 lines so it loads cheaply.
- When repository structure moves, update the affected skills in the same
  change, following [agent-maintenance.md](agent-maintenance.md).
