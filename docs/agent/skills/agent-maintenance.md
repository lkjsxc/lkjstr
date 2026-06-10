# Skill: Agent Maintenance

## Purpose

Maintain `AGENTS.md`, the agent manual under `docs/agent/`, and the skills so
the agent entrypoint stays compact, truthful, and routable as the repository
changes.

## Trigger

The change touches `AGENTS.md`, `docs/agent/`, or repository structure that
skills reference: moved paths, renamed commands, changed gates, or a new
recurring kind of work.

## Read First

- [README.md](README.md) for the skill format contract.
- [../README.md](../README.md) for the manual authority model.
- [../../repository/documentation-standards.md](../../repository/documentation-standards.md).
- [../../repository/llm-maintenance.md](../../repository/llm-maintenance.md).

## Files Likely Touched

- `AGENTS.md`.
- `docs/agent/README.md`, `docs/agent/work-loop.md`,
  `docs/agent/no-fake-data.md`, `docs/agent/handoff.md`.
- Skill files in this directory.
- `docs/README.md` and `README.md` indexes when files are added or removed.
- `scripts/repo-doc-skill-shape.ts` and
  `crates/lkjstr-xtask/src/doc_check.rs` when the skill format changes.

## Procedure

1. Keep `AGENTS.md` a compact gateway: identity, non-negotiables, read order,
   task routing, verification summary, and handoff pointer. Detail belongs in
   the manual or the canonical contract.
2. Keep each rule owned once. If a rule appears in two places, pick the owner
   and link from the other.
3. Add a skill only for recurring real work, with real paths and commands
   verified against the current tree.
4. When repository paths or gates move, update every skill that names them in
   the same change.
5. Update the skill-shape checks when the required headings change, in both
   the TypeScript and the xtask checker.

## Focused Gate

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

When the checker source changed, add:

```sh
cargo test -p lkjstr-xtask
pnpm test:quiet
```

## Final Gate

Not required for agent-doc-only changes. Record it as not run.

## Must Not

- Do not create placeholder skills or skills without a recurring task.
- Do not duplicate contract detail into `AGENTS.md`.
- Do not remove the `docs/README.md` and `docs/current-state.md` links from
  `AGENTS.md` or `README.md`; repository checks require them.
- Do not let a skill reference a path or command that no longer exists.
- Do not grow a skill past 120 lines; split the underlying contract instead.

## Handoff

Name which routing changed and confirm every index that lists the changed
files was updated.
