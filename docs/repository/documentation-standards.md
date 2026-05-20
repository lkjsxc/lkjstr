# Documentation Standards

## Purpose

Documentation should be readable by people and language models. Prefer direct
headings, short sections, recursive navigation, and explicit constraints over
narrative background.

## File Shape

Every documentation file starts with an H1, then a `Purpose` section. Every
tracked, non-generated directory has a `README.md` local table of contents.
Directory indexes add `Documents` and may add `Tree` when recursive navigation
helps.

## Content Rules

- Write English docs.
- Put the most useful summary near the top.
- Keep one topic per file.
- Link related files with relative Markdown links.
- Keep each file at or below 300 lines.
- Keep source files at or below 200 lines.
- Update docs before implementation when behavior, contracts, or workflows
  change.
- Keep docs and implementation in the same change when they define one behavior.
- Avoid milestone labels in filenames and headings.
- Avoid release shorthand wording.
- Record uncertainty as an explicit assumption or open question.

## Directory Rules

- Every tracked, non-generated directory contains exactly one `README.md`.
- The stricter branching rule applies only under `docs/`.
- `docs/README.md` is the recursive table of contents for the full docs tree.
- Child `README.md` files are local directory indexes for sibling topics.
- Supporting files hold the detail so the `README.md` remains scannable.

## Product Rules

- Settings remains a flat vertical key-value list.
- Docker Compose services do not mount the source tree, use `develop`, or use
  watch-style sync.
