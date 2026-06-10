# LLM Maintenance

## Purpose

This file defines how agents should shape lkjstr so future agents can read,
change, and verify it with minimal hidden context.

## Reading Order

The agent entry read order lives in `AGENTS.md`; the per-change loop lives in
[../agent/work-loop.md](../agent/work-loop.md). For repository maintenance:

1. Read [../current-state.md](../current-state.md) for implemented behavior.
2. Read the nearest product or architecture contract for the surface being
   changed.
3. Read [functional-style.md](functional-style.md) before changing `src/`.
4. Read [workflow.md](workflow.md) before selecting verification commands.

## Documentation Shape

- Keep the contract tree explicit: every `docs/` directory has one
  `README.md` plus multiple child documents or child directories.
- Keep `README.md` files as maps. Put detailed contracts in sibling files.
- Prefer one contract per file with a short H1, `Purpose`, then the current
  behavior.
- Link to source areas by directory when the exact implementation may move.
- Mark uncertainty as an open question instead of implying behavior exists.
- Avoid release shorthand, migration framing, and compatibility promises.

## Source Shape

- Keep source modules under 200 lines by extracting pure helpers or small
  effect factories.
- Prefer pure data transforms and reducers before component-local branching.
- Give every effect owner an explicit cleanup method and a bounded collection
  policy.
- Put browser, relay, timer, and storage effects behind factory handles.
- Add tests at the same ownership level as the behavior being changed.

## Metadata

- Keep GitHub metadata documentation in `.github/_README.md`, not
  `.github/README.md`. The repository root `README.md` must remain the page
  GitHub displays for the project.
- Keep `.github/workflows/README.md` as a workflow index only.

## Stop Condition

A change is ready only when the docs, source, focused tests, repository checks,
and Docker Compose gate agree about the same current behavior.
