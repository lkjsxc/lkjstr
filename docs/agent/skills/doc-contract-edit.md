# Skill: Doc Contract Edit

## Purpose

Change product, protocol, architecture, operations, repository, or decision
contracts without touching source, while keeping the docs tree valid and
truthful.

## Trigger

The change touches only Markdown under `docs/`, `README.md`, or `AGENTS.md`.

## Read First

- [../../repository/documentation-standards.md](../../repository/documentation-standards.md).
- [../../current-state.md](../../current-state.md).
- The README of the docs subtree being changed.
- The current contract file being changed, fully.

## Files Likely Touched

- The contract file under `docs/`.
- The subtree `README.md` table of contents when files are added, renamed,
  or removed.
- [../../README.md](../../README.md) when files are added, renamed, or
  removed anywhere under `docs/`.
- [../../current-state.md](../../current-state.md) only when the implemented
  summary it states changes.

## Procedure

1. Find the canonical owner of the statement being changed. Do not create a
   second semi-canonical copy; link to the owner instead.
2. Verify every behavior claim against current source or tests before writing
   it in present tense. Mark anything else with an explicit status:
   implemented, design-only, not implemented, out of scope, or open question.
3. Edit the contract. Keep one topic per file, the H1 plus `Purpose` shape,
   ASCII prose, and at most 300 lines.
4. Update every README table of contents that lists the changed files. Docs
   READMEs list descendants recursively.
5. Keep links relative and resolving. New docs directories need a README plus
   at least two children.

## Focused Gate

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

## Final Gate

Not required for docs-only changes. Record it as not run.

## Must Not

- Do not write future behavior as current behavior.
- Do not use release shorthand, milestone names, or compatibility framing.
- Do not document fake data paths as product behavior; see
  [../no-fake-data.md](../no-fake-data.md).
- Do not delete a contract unless its content is preserved or deliberately
  retired in the same change.
- Do not let a doc disagree with `docs/current-state.md` at the end of the
  slice.

## Handoff

Name the canonical owner of each changed statement and confirm which indexes
were updated.
